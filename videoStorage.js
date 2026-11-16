const DATABASE_NAME = "yashil-texnikum-media";
const DATABASE_VERSION = 2;
const VIDEO_STORE_NAME = "videos";
const IMAGE_STORE_NAME = "images";

function openDatabase() {
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error("Brauzer media saqlashni qo‘llamaydi."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(VIDEO_STORE_NAME)) {
        database.createObjectStore(VIDEO_STORE_NAME, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        database.createObjectStore(IMAGE_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Media bazasini ochib bo‘lmadi."));
    request.onblocked = () =>
      reject(new Error("Media bazasi boshqa tabda band."));
  });
}

function transactionResult(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error || new Error("Media saqlash bekor qilindi."));
    transaction.onerror = () =>
      reject(transaction.error || new Error("Media saqlashda xatolik."));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Media faylini o‘qib bo‘lmadi."));
  });
}

function createMediaId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function saveFile(storeName, file) {
  const database = await openDatabase();
  const id = createMediaId();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    const completed = transactionResult(transaction);
    transaction.objectStore(storeName).put({
      id,
      blob: file,
      name: file.name,
      type: file.type,
    });
    await completed;
    return id;
  } finally {
    database.close();
  }
}

async function loadFile(storeName, id) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readonly");
    const completed = transactionResult(transaction);
    const [result] = await Promise.all([
      requestResult(transaction.objectStore(storeName).get(id)),
      completed,
    ]);
    return result?.blob || null;
  } finally {
    database.close();
  }
}

async function deleteFile(storeName, id) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    const completed = transactionResult(transaction);
    transaction.objectStore(storeName).delete(id);
    await completed;
  } finally {
    database.close();
  }
}

export const saveVideoFile = (file) => saveFile(VIDEO_STORE_NAME, file);
export const loadVideoFile = (id) => loadFile(VIDEO_STORE_NAME, id);
export const deleteVideoFile = (id) => deleteFile(VIDEO_STORE_NAME, id);
export const saveImageFile = (file) => saveFile(IMAGE_STORE_NAME, file);
export const loadImageFile = (id) => loadFile(IMAGE_STORE_NAME, id);
export const deleteImageFile = (id) => deleteFile(IMAGE_STORE_NAME, id);
