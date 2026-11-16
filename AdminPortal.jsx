import React, { useEffect, useState } from "react";
import {
  loadImageFile,
  loadVideoFile,
} from "./videoStorage.js";
import { normalizeTelegramBotUrl } from "./registrationSettings.js";
import { BLOG_STORAGE_KEY } from "./blogStorage.js";
import {
  deletePost as deleteSupabasePost,
  deletePostMedia,
  isSupabaseConfigured,
  savePost as saveSupabasePost,
  supabase,
  uploadPostMedia,
} from "./supabase.js";

function getYouTubeVideoId(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let videoId = "";
    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      videoId =
        url.searchParams.get("v") ||
        url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ||
        "";
    }
    return /^[\w-]{11}$/.test(videoId) ? videoId : "";
  } catch {
    return "";
  }
}

function AdminPortal({
  onClose,
  posts,
  setPosts,
  storageError,
  programs,
  setPrograms,
  programStorageError,
  registrationSettings,
  setRegistrationSettings,
  registrationStorageError,
  phoneNumbers,
  setPhoneNumbers,
  phoneStorageError,
}) {
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [uiError, setUiError] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isMigratingPosts, setIsMigratingPosts] = useState(false);
  const [legacyPostCount, setLegacyPostCount] = useState(0);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [activeSection, setActiveSection] = useState("articles");
  const [videoMode, setVideoMode] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [isSavingPost, setIsSavingPost] = useState(false);
  const [programTitle, setProgramTitle] = useState("");
  const [programDescription, setProgramDescription] = useState("");
  const [telegramBotUrl, setTelegramBotUrl] = useState(
    registrationSettings.url,
  );
  const [contactPhoneDrafts, setContactPhoneDrafts] = useState(phoneNumbers);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthReady(true);
      return undefined;
    }

    let active = true;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) {
          return;
        }
        if (error) {
          throw error;
        }
        setAuthenticated(Boolean(data.session));
        setAuthReady(true);
      })
      .catch((error) => {
        console.error("Could not load the Supabase session.", error);
        if (active) {
          setUiError(error.message || "Admin sessiyasini tekshirib bo‘lmadi.");
          setAuthReady(true);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(Boolean(session));
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setTelegramBotUrl(registrationSettings.url);
  }, [registrationSettings.url]);

  useEffect(() => {
    try {
      const savedPosts = localStorage.getItem(BLOG_STORAGE_KEY);
      if (savedPosts) {
        const parsedPosts = JSON.parse(savedPosts);
        if (Array.isArray(parsedPosts)) {
          setLegacyPostCount(parsedPosts.length);
        }
      }
    } catch (error) {
      console.error("Could not inspect local blog posts for migration.", error);
      setUiError("Eski brauzer maqolalarini tekshirib bo‘lmadi.");
    }
  }, []);

  useEffect(() => {
    setContactPhoneDrafts(phoneNumbers);
  }, [phoneNumbers]);

  function resetEditor() {
    setTitle("");
    setSummary("");
    setBody("");
    setEditingId(null);
    setVideoMode("");
    setVideoUrl("");
    setVideoFile(null);
    setImageFile(null);
    setRemoveExistingImage(false);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setUiError("");
    setNotice("");

    if (!supabase) {
      setUiError(
        "Supabase sozlanmagan. Avval .env.local fayliga loyiha ma’lumotlarini kiriting.",
      );
      return;
    }

    setIsBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        throw error;
      }
      setPassword("");
    } catch (error) {
      console.error("Could not sign in to Supabase.", error);
      setUiError(error.message || "Admin sifatida kirib bo‘lmadi.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLogout() {
    setUiError("");
    setNotice("");
    if (!supabase) {
      return;
    }
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Could not sign out from Supabase.", error);
      setUiError(error.message || "Admin hisobidan chiqib bo‘lmadi.");
    }
  }

  async function handleSavePost(event) {
    event.preventDefault();
    setUiError("");
    setNotice("");

    const cleanTitle = title.trim();
    const cleanSummary = summary.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanSummary || !cleanBody) {
      setUiError("Sarlavha, qisqa matn va maqola matnini to‘ldiring.");
      return;
    }
    if (storageError) {
      setUiError(storageError);
      return;
    }

    const previousPost = posts.find((post) => post.id === editingId);
    const postId =
      editingId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let video = null;
    let image = removeExistingImage ? null : previousPost?.image || null;
    if (videoMode === "youtube") {
      const videoId = getYouTubeVideoId(videoUrl.trim());
      if (!videoId) {
        setUiError("YouTube videosining to‘g‘ri havolasini kiriting.");
        return;
      }
      video = { type: "youtube", url: videoUrl.trim(), videoId };
    } else if (videoMode === "file") {
      if (videoFile) {
        if (!videoFile.type.startsWith("video/")) {
          setUiError("Video fayl formatini tekshiring.");
          return;
        }
      } else if (previousPost?.video?.type !== "file") {
        if (previousPost?.video?.type !== "remote") {
          setUiError("Yuklash uchun video faylni tanlang.");
          return;
        }
      }
    }
    if (imageFile && !imageFile.type.startsWith("image/")) {
      setUiError("Rasm fayl formatini tekshiring.");
      return;
    }

    setIsSavingPost(true);
    try {
      if (videoMode === "file") {
        if (videoFile) {
          video = await uploadPostMedia(videoFile, postId, "video");
        } else if (previousPost?.video?.type === "remote") {
          video = previousPost.video;
        } else if (previousPost?.video?.type === "file") {
          const legacyVideo = await loadVideoFile(previousPost.video.id);
          if (!legacyVideo) {
            throw new Error("Eski video fayli bu brauzerda topilmadi.");
          }
          const file =
            legacyVideo.name === previousPost.video.name
              ? legacyVideo
              : new File([legacyVideo], previousPost.video.name, {
                  type: previousPost.video.mimeType || legacyVideo.type,
                });
          video = await uploadPostMedia(file, postId, "video");
        }
      }
      if (imageFile) {
        image = await uploadPostMedia(imageFile, postId, "image");
      } else if (image?.type === "file") {
        const legacyImage = await loadImageFile(image.id);
        if (!legacyImage) {
          throw new Error("Eski rasm fayli bu brauzerda topilmadi.");
        }
        const file =
          legacyImage.name === image.name
            ? legacyImage
            : new File([legacyImage], image.name, {
                type: image.mimeType || legacyImage.type,
              });
        image = await uploadPostMedia(file, postId, "image");
      }

      const savedPost = {
        ...previousPost,
        id: postId,
        title: cleanTitle,
        summary: cleanSummary,
        body: cleanBody,
        date: previousPost?.date || new Date().toLocaleDateString("uz-UZ"),
        created_at: previousPost?.created_at || new Date().toISOString(),
        video,
        image,
      };
      await saveSupabasePost(savedPost);
      setPosts((currentPosts) => [
        savedPost,
        ...currentPosts.filter((post) => post.id !== postId),
      ]);
      setNotice(editingId ? "Maqola yangilandi." : "Maqola saytga joylandi.");

      try {
        await deletePostMedia(
          previousPost?.image?.path !== image?.path ? previousPost?.image : null,
          previousPost?.video?.path !== video?.path ? previousPost?.video : null,
        );
      } catch (error) {
        console.error("Could not remove replaced blog media.", error);
        setUiError(
          `Maqola saqlandi, lekin eski media faylini o‘chirib bo‘lmadi: ${error.message}`,
        );
      }
      resetEditor();
      setActiveSection("articles");
    } catch (error) {
      console.error("Could not save blog post to Supabase.", error);
      setUiError(
        error.message || "Maqolani bazaga saqlab bo‘lmadi.",
      );
    } finally {
      setIsSavingPost(false);
    }
  }

  async function migrateLegacyPosts() {
    setUiError("");
    setNotice("");
    setIsMigratingPosts(true);

    try {
      const storedPosts = localStorage.getItem(BLOG_STORAGE_KEY);
      const legacyPosts = storedPosts ? JSON.parse(storedPosts) : [];
      if (
        !Array.isArray(legacyPosts) ||
        legacyPosts.some(
          (post) =>
            !post ||
            typeof post.id !== "string" ||
            typeof post.title !== "string" ||
            typeof post.summary !== "string" ||
            typeof post.body !== "string" ||
            typeof post.date !== "string",
        )
      ) {
        throw new Error("Brauzerda saqlangan maqolalar formati noto‘g‘ri.");
      }

      const migratedPosts = [];
      for (const post of legacyPosts) {
        let image = post.image || null;
        let video = post.video || null;
        if (image?.type === "file") {
          const fileData = await loadImageFile(image.id);
          if (!fileData) {
            throw new Error(`“${post.title}” maqolasining rasmi topilmadi.`);
          }
          const file =
            fileData.name === image.name
              ? fileData
              : new File([fileData], image.name, {
                  type: image.mimeType || fileData.type,
                });
          image = await uploadPostMedia(file, post.id, "image");
        }
        if (video?.type === "file") {
          const fileData = await loadVideoFile(video.id);
          if (!fileData) {
            throw new Error(`“${post.title}” maqolasining videosi topilmadi.`);
          }
          const file =
            fileData.name === video.name
              ? fileData
              : new File([fileData], video.name, {
                  type: video.mimeType || fileData.type,
                });
          video = await uploadPostMedia(file, post.id, "video");
        }
        const migratedPost = {
          ...post,
          image,
          video,
          created_at: post.created_at || new Date().toISOString(),
        };
        await saveSupabasePost(migratedPost);
        migratedPosts.push(migratedPost);
      }

      localStorage.removeItem(BLOG_STORAGE_KEY);
      setLegacyPostCount(0);
      setPosts((currentPosts) => [
        ...migratedPosts,
        ...currentPosts.filter(
          (post) => !migratedPosts.some((item) => item.id === post.id),
        ),
      ]);
      setNotice(`${migratedPosts.length} ta eski maqola bazaga ko‘chirildi.`);
    } catch (error) {
      console.error("Could not migrate local blog posts.", error);
      setUiError(
        `Eski maqolalarni ko‘chirish yakunlanmadi: ${error.message}`,
      );
    } finally {
      setIsMigratingPosts(false);
    }
  }

  function startEditing(post) {
    setEditingId(post.id);
    setTitle(post.title);
    setSummary(post.summary);
    setBody(post.body);
    setVideoMode(
      post.video?.type === "youtube"
        ? "youtube"
        : post.video
          ? "file"
          : "",
    );
    setVideoUrl(post.video?.url || "");
    setVideoFile(null);
    setImageFile(null);
    setRemoveExistingImage(false);
    setUiError("");
    setNotice("");
    setActiveSection("edit");
  }

  function startNewPost() {
    resetEditor();
    setUiError("");
    setNotice("");
    setActiveSection("new");
  }

  function closeEditor() {
    resetEditor();
    setActiveSection("articles");
  }

  function handleAddProgram(event) {
    event.preventDefault();
    setUiError("");
    setNotice("");

    const cleanTitle = programTitle.trim();
    const cleanDescription = programDescription.trim();
    if (!cleanTitle || !cleanDescription) {
      setUiError("Yo‘nalish nomi va tavsifini to‘ldiring.");
      return;
    }
    if (programStorageError) {
      setUiError(programStorageError);
      return;
    }

    const nextNumber = String(
      Math.max(
        0,
        ...programs.map((program) => Number.parseInt(program.number, 10) || 0),
      ) + 1,
    ).padStart(2, "0");
    setPrograms((currentPrograms) => [
      ...currentPrograms,
      {
        number: nextNumber,
        title: cleanTitle,
        description: cleanDescription,
        icon: "◈",
      },
    ]);
    setProgramTitle("");
    setProgramDescription("");
    setNotice("Yangi yo‘nalish qo‘shildi.");
  }

  function handleDeleteProgram(programNumber) {
    setUiError("");
    setNotice("");
    if (programStorageError) {
      setUiError(programStorageError);
      return;
    }

    setPrograms((currentPrograms) =>
      currentPrograms.filter((program) => program.number !== programNumber),
    );
    setNotice("Yo‘nalish o‘chirildi.");
  }

  function handleSaveBotSettings(event) {
    event.preventDefault();
    setUiError("");
    setNotice("");

    const cleanUrl = normalizeTelegramBotUrl(telegramBotUrl);
    if (!cleanUrl) {
      setUiError("https://t.me/ yoki https://telegram.me/ bot havolasini kiriting.");
      return;
    }
    if (registrationStorageError) {
      setUiError(registrationStorageError);
      return;
    }

    setRegistrationSettings((currentSettings) => ({
      ...currentSettings,
      url: cleanUrl,
    }));
    setNotice("Telegram bot havolasi saqlandi.");
  }

  function handleToggleRegistration() {
    setUiError("");
    setNotice("");
    if (registrationStorageError) {
      setUiError(registrationStorageError);
      return;
    }
    if (
      !registrationSettings.enabled &&
      !normalizeTelegramBotUrl(registrationSettings.url)
    ) {
      setUiError("Avval Telegram bot havolasini saqlang.");
      return;
    }

    const enabled = !registrationSettings.enabled;
    setRegistrationSettings((currentSettings) => ({
      ...currentSettings,
      enabled,
    }));
    setNotice(
      enabled
        ? "Ro‘yxatdan o‘tish tugmasi yoqildi."
        : "Ro‘yxatdan o‘tish tugmasi o‘chirildi.",
    );
  }

  function handleSavePhoneNumbers(event) {
    event.preventDefault();
    setUiError("");
    setNotice("");

    const cleanPhoneNumbers = contactPhoneDrafts
      .map((phone) => phone.trim())
      .filter(Boolean);
    if (
      cleanPhoneNumbers.length === 0 ||
      cleanPhoneNumbers.some((phone) => {
        const digitCount = phone.replace(/\D/g, "").length;
        return digitCount < 7 || digitCount > 15;
      })
    ) {
      setUiError("Kamida bitta to‘g‘ri telefon raqamini kiriting.");
      return;
    }
    if (phoneStorageError) {
      setUiError(phoneStorageError);
      return;
    }

    setPhoneNumbers(cleanPhoneNumbers);
    setNotice("Telefon raqamlari oddiy saytda yangilandi.");
  }

  async function deletePost(postId) {
    const post = posts.find((item) => item.id === postId);
    setUiError("");
    setNotice("");
    try {
      await deleteSupabasePost(postId);
    } catch (error) {
      console.error("Could not delete blog post from Supabase.", error);
      setUiError(error.message || "Maqolani bazadan o‘chirib bo‘lmadi.");
      return;
    }

    setPosts((currentPosts) =>
      currentPosts.filter((post) => post.id !== postId),
    );
    if (editingId === postId) {
      resetEditor();
      setActiveSection("articles");
    }
    try {
      await deletePostMedia(post?.image, post?.video);
      setNotice("Maqola o‘chirildi.");
    } catch (error) {
      console.error("Could not delete media for the removed blog post.", error);
      setUiError(
        `Maqola o‘chirildi, lekin media fayllarini o‘chirishda xatolik: ${error.message}`,
      );
    }
  }

  return (
    <>
      <header className="admin-header">
        <div className="admin-header-inner">
          <a className="brand" href="#bosh-sahifa" onClick={onClose}>
            <span>
              <strong>YASHIL</strong>
              <small>TEXNIKUMI</small>
            </span>
          </a>
          <button className="admin-back" onClick={onClose} type="button">
            ← Saytga qaytish
          </button>
        </div>
      </header>

      <main className="admin-main">
        {!authReady ? (
          <p className="admin-empty">Admin bo‘limi yuklanmoqda…</p>
        ) : !authenticated ? (
          <>
            <div className="admin-heading">
              <div className="section-label">
                <span>ADMIN</span> / KIRISH
              </div>
              <h1>Sayt boshqaruvi.</h1>
              <p>
                Maqolalar va ta’lim yo‘nalishlarini shu bo‘limda boshqaring.
              </p>
            </div>
            {uiError && <p className="admin-feedback is-error">{uiError}</p>}
            <section className="admin-auth-card">
              <h2>Supabase admin hisobi bilan kirish</h2>
              <p>
                Admin hisobini Supabase Dashboard orqali yarating. Bu yerda
                hisob ochish imkoni yo‘q.
              </p>
              {!isSupabaseConfigured && (
                <p className="admin-feedback is-error">
                  Supabase URL va key sozlanmagan. Ko‘rsatmalar:
                  SUPABASE_SETUP.md
                </p>
              )}
              <form className="admin-form admin-auth-form" onSubmit={handleLogin}>
                <label>
                  Email
                  <input
                    autoComplete="username"
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                </label>
                <label>
                  Parol
                  <input
                    autoComplete="current-password"
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </label>
                <button
                  className="admin-submit"
                  disabled={isBusy || !isSupabaseConfigured}
                  type="submit"
                >
                  {isBusy ? "Kuting…" : "Admin bo‘limiga kirish"}
                </button>
              </form>
            </section>
          </>
        ) : (
          <section className="admin-dashboard">
            <div className="admin-workspace">
              <aside aria-label="Admin menyusi" className="admin-sidebar">
                <span className="admin-sidebar-label">BOSHQARUV</span>
                <button
                  className={
                    activeSection === "articles"
                      ? "admin-sidebar-link is-active"
                      : "admin-sidebar-link"
                  }
                  onClick={closeEditor}
                  type="button"
                >
                  <span aria-hidden="true">▤</span> Maqolalar
                </button>
                <button
                  className={
                    activeSection === "new"
                      ? "admin-sidebar-link is-active"
                      : "admin-sidebar-link"
                  }
                  onClick={startNewPost}
                  type="button"
                >
                  <span aria-hidden="true">＋</span> Maqola qo‘shish
                </button>
                <button
                  className={
                    activeSection === "programs"
                      ? "admin-sidebar-link is-active"
                      : "admin-sidebar-link"
                  }
                  onClick={() => {
                    setUiError("");
                    setNotice("");
                    setActiveSection("programs");
                  }}
                  type="button"
                >
                  <span aria-hidden="true">⌖</span> Yo‘nalishlar
                </button>
                <button
                  className={
                    activeSection === "bot"
                      ? "admin-sidebar-link is-active"
                      : "admin-sidebar-link"
                  }
                  onClick={() => {
                    setUiError("");
                    setNotice("");
                    setActiveSection("bot");
                  }}
                  type="button"
                >
                  <span aria-hidden="true">↗</span> Bot
                </button>
              </aside>

              <div className="admin-content">
                <section className="admin-overview">
                  <div className="section-label">
                    <span>ADMIN</span> / BOSHQARUV
                  </div>
                  <h1>Sayt boshqaruvi.</h1>
                  <p>
                    Maqolalar, yo‘nalishlar va sayt ma’lumotlarini shu yerdan
                    boshqaring.
                  </p>
                  <div className="admin-summary-grid">
                    <article>
                      <span>MAQOLALAR</span>
                      <strong>{posts.length}</strong>
                    </article>
                    <article>
                      <span>YO‘NALISHLAR</span>
                      <strong>{programs.length}</strong>
                    </article>
                    <article>
                      <span>SAQLANISHI</span>
                      <strong>Umumiy baza</strong>
                    </article>
                  </div>
                  {legacyPostCount > 0 && (
                    <div className="admin-feedback">
                      Brauzerda {legacyPostCount} ta eski maqola bor.
                      <button
                        className="admin-submit"
                        disabled={isMigratingPosts}
                        onClick={migrateLegacyPosts}
                        type="button"
                      >
                        {isMigratingPosts
                          ? "Ko‘chirilmoqda…"
                          : "Eski maqolalarni bazaga ko‘chirish"}
                      </button>
                    </div>
                  )}
                </section>

                {uiError && (
                  <p className="admin-feedback is-error">{uiError}</p>
                )}
                {notice && (
                  <p className="admin-feedback is-success">{notice}</p>
                )}
                {storageError && (
                  <p className="admin-feedback is-error">{storageError}</p>
                )}
                {programStorageError && (
                  <p className="admin-feedback is-error">
                    {programStorageError}
                  </p>
                )}
                {registrationStorageError && (
                  <p className="admin-feedback is-error">
                    {registrationStorageError}
                  </p>
                )}
                {phoneStorageError && (
                  <p className="admin-feedback is-error">{phoneStorageError}</p>
                )}

                <div className="admin-dashboard-heading">
                  <div>
                    <h2>
                      {activeSection === "programs"
                        ? "Yo‘nalishlar"
                        : activeSection === "bot"
                          ? "Telegram bot"
                        : activeSection === "new"
                          ? "Yangi maqola"
                          : activeSection === "edit"
                            ? "Maqolani tahrirlash"
                            : "Maqolalar"}
                    </h2>
                    <p>
                      {activeSection === "programs"
                        ? `${programs.length} ta yo‘nalish`
                        : activeSection === "bot"
                          ? registrationSettings.enabled
                            ? "Ro‘yxatdan o‘tish tugmasi faol"
                            : "Ro‘yxatdan o‘tish tugmasi o‘chiq"
                        : `${posts.length} ta maqola`}
                    </p>
                  </div>
                  <button
                    className="admin-logout"
                    onClick={handleLogout}
                    type="button"
                  >
                    Chiqish
                  </button>
                </div>

                {activeSection === "bot" ? (
                  <>
                    <section className="admin-editor admin-bot-manager">
                      <h3>Ro‘yxatdan o‘tish boti</h3>
                      <p className="admin-program-description">
                        Telegram bot havolasini saqlang, so‘ng oddiy saytdagi
                        ro‘yxatdan o‘tish tugmasini yoqing.
                      </p>
                      <form
                        className="admin-form"
                        onSubmit={handleSaveBotSettings}
                      >
                        <label>
                          Telegram bot havolasi
                          <input
                            onChange={(event) =>
                              setTelegramBotUrl(event.target.value)
                            }
                            placeholder="https://t.me/bot_nomi"
                            required
                            type="url"
                            value={telegramBotUrl}
                          />
                        </label>
                        <p className="admin-bot-hint">
                          Havola `https://t.me/...` yoki
                          `https://telegram.me/...` ko‘rinishida bo‘lishi
                          kerak.
                        </p>
                        <div className="admin-form-actions">
                          <button
                            className="admin-submit"
                            disabled={Boolean(registrationStorageError)}
                            type="submit"
                          >
                            Havolani saqlash
                          </button>
                          <button
                            className={
                              registrationSettings.enabled
                                ? "admin-toggle is-enabled"
                                : "admin-toggle"
                            }
                            disabled={
                              Boolean(registrationStorageError) ||
                              (!registrationSettings.enabled &&
                                !normalizeTelegramBotUrl(
                                  registrationSettings.url,
                                ))
                            }
                            onClick={handleToggleRegistration}
                            type="button"
                          >
                            {registrationSettings.enabled
                              ? "Tugmani o‘chirish"
                              : "Tugmani yoqish"}
                          </button>
                        </div>
                      </form>
                      <p className="admin-bot-state">
                        Hozirgi holat:{" "}
                        <strong>
                          {registrationSettings.enabled ? "Faol" : "O‘chiq"}
                        </strong>
                        . Tugma yoqilganda oddiy saytning tepa panelida
                        ko‘rinadi.
                      </p>
                    </section>
                    <section className="admin-editor admin-phone-manager">
                      <h3>Saytdagi telefon raqamlari</h3>
                      <p className="admin-program-description">
                        Bu raqamlar oddiy saytdagi “Aloqa” bo‘limida ko‘rinadi.
                      </p>
                      <form
                        className="admin-form"
                        onSubmit={handleSavePhoneNumbers}
                      >
                        <div className="admin-phone-list">
                          {contactPhoneDrafts.map((phone, index) => (
                            <div className="admin-phone-row" key={index}>
                              <label>
                                Telefon raqami {index + 1}
                                <input
                                  autoComplete="tel"
                                  onChange={(event) =>
                                    setContactPhoneDrafts((currentPhones) =>
                                      currentPhones.map(
                                        (currentPhone, itemIndex) =>
                                          itemIndex === index
                                            ? event.target.value
                                            : currentPhone,
                                      ),
                                    )
                                  }
                                  placeholder="+998 90 123 45 67"
                                  type="tel"
                                  value={phone}
                                />
                              </label>
                              <button
                                aria-label={`Telefon raqami ${index + 1}ni olib tashlash`}
                                className="admin-delete"
                                onClick={() =>
                                  setContactPhoneDrafts((currentPhones) =>
                                    currentPhones.filter(
                                      (_currentPhone, itemIndex) =>
                                        itemIndex !== index,
                                    ),
                                  )
                                }
                                type="button"
                              >
                                O‘chirish
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="admin-form-actions">
                          <button
                            className="admin-cancel"
                            onClick={() =>
                              setContactPhoneDrafts((currentPhones) => [
                                ...currentPhones,
                                "",
                              ])
                            }
                            type="button"
                          >
                            Raqam qo‘shish
                          </button>
                          <button
                            className="admin-submit"
                            disabled={Boolean(phoneStorageError)}
                            type="submit"
                          >
                            Raqamlarni saqlash
                          </button>
                        </div>
                      </form>
                    </section>
                  </>
                ) : activeSection === "programs" ? (
                  <section className="admin-editor admin-program-manager">
                    <h3>Ta’lim yo‘nalishlari</h3>
                    <p className="admin-program-description">
                      Qo‘shilgan yoki o‘chirilgan yo‘nalishlar asosiy sahifada
                      ko‘rinadi.
                    </p>
                    <form
                      className="admin-form"
                      onSubmit={handleAddProgram}
                    >
                      <label>
                        Yo‘nalish nomi
                        <input
                          maxLength={100}
                          onChange={(event) =>
                            setProgramTitle(event.target.value)
                          }
                          required
                          value={programTitle}
                        />
                      </label>
                      <label>
                        Qisqa tavsif
                        <textarea
                          maxLength={260}
                          onChange={(event) =>
                            setProgramDescription(event.target.value)
                          }
                          required
                          rows={3}
                          value={programDescription}
                        />
                      </label>
                      <button
                        className="admin-submit"
                        disabled={Boolean(programStorageError)}
                        type="submit"
                      >
                        Yo‘nalish qo‘shish
                      </button>
                    </form>

                    <div className="admin-program-list">
                      {programs.length ? (
                        programs.map((program) => (
                          <article
                            className="admin-program-item"
                            key={program.number}
                          >
                            <div>
                              <span>{program.number}</span>
                              <h4>{program.title}</h4>
                              <p>{program.description}</p>
                            </div>
                            <button
                              aria-label={`O‘chirish: ${program.title}`}
                              className="admin-delete"
                              disabled={Boolean(programStorageError)}
                              onClick={() =>
                                handleDeleteProgram(program.number)
                              }
                              type="button"
                            >
                              O‘chirish
                            </button>
                          </article>
                        ))
                      ) : (
                        <p className="admin-empty">
                          Hali yo‘nalish qo‘shilmagan.
                        </p>
                      )}
                    </div>
                  </section>
                ) : activeSection === "new" || activeSection === "edit" ? (
                  <form
                    className="admin-form admin-editor"
                    onSubmit={handleSavePost}
                  >
                    <h3>
                      {editingId ? "Maqolani tahrirlash" : "Yangi maqola"}
                    </h3>
                    <label>
                      Sarlavha
                      <input
                        maxLength={100}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                        value={title}
                      />
                    </label>
                    <label>
                      Qisqa izoh
                      <textarea
                        maxLength={260}
                        onChange={(event) => setSummary(event.target.value)}
                        required
                        rows={3}
                        value={summary}
                      />
                    </label>
                    <label>
                      Maqola matni
                      <textarea
                        onChange={(event) => setBody(event.target.value)}
                        required
                        rows={10}
                        value={body}
                      />
                    </label>
                    <div className="admin-media-upload">
                      <h4>Maqolaga rasm qo‘shish</h4>
                      <label className="admin-file-picker">
                        <span className="admin-file-picker-action">
                          <span aria-hidden="true">↑</span> Rasm tanlash
                        </span>
                        <span className="admin-file-picker-name">
                          {imageFile?.name || "Rasm fayli tanlanmagan"}
                        </span>
                        <input
                          aria-label="Rasm faylini tanlash"
                          accept="image/*"
                          onChange={(event) => {
                            setImageFile(event.target.files?.[0] || null);
                            setRemoveExistingImage(false);
                          }}
                          type="file"
                        />
                      </label>
                      {!imageFile &&
                      editingId &&
                        posts.find((post) => post.id === editingId)?.image &&
                        !removeExistingImage ? (
                        <div className="admin-media-current">
                          <p>
                            Hozirgi rasm:{" "}
                            {
                              posts.find((post) => post.id === editingId).image
                                .name || "mavjud"
                            }
                          </p>
                          <button
                            className="admin-cancel"
                            onClick={() => setRemoveExistingImage(true)}
                            type="button"
                          >
                            Rasmni olib tashlash
                          </button>
                        </div>
                      ) : removeExistingImage ? (
                        <p>Rasm maqoladan olib tashlanadi.</p>
                      ) : !imageFile ? (
                        <p>Rasm Supabase umumiy xotirasiga yuklanadi.</p>
                      ) : null}
                    </div>
                    <div className="admin-media-upload">
                      <h4>Maqolaga video qo‘shish (ixtiyoriy)</h4>
                      <label>
                        Video manbasi
                        <select
                          onChange={(event) => {
                            setVideoMode(event.target.value);
                            setVideoFile(null);
                          }}
                          value={videoMode}
                        >
                          <option value="">Videosiz maqola</option>
                          <option value="youtube">YouTube havolasi</option>
                          <option value="file">Video fayl yuklash</option>
                        </select>
                      </label>
                      {videoMode === "youtube" && (
                        <label>
                          YouTube havolasi
                          <input
                            onChange={(event) => setVideoUrl(event.target.value)}
                            placeholder="https://youtu.be/..."
                            type="url"
                            value={videoUrl}
                          />
                        </label>
                      )}
                      {videoMode === "file" && (
                        <div className="admin-video-upload">
                          <label className="admin-file-picker">
                            <span className="admin-file-picker-action">
                              <span aria-hidden="true">↑</span> Video faylni
                              tanlash
                            </span>
                            <span className="admin-file-picker-name">
                              {videoFile?.name || "Video fayli tanlanmagan"}
                            </span>
                            <input
                              aria-label="Video faylini tanlash"
                              accept="video/*"
                              onChange={(event) =>
                                setVideoFile(event.target.files?.[0] || null)
                              }
                              type="file"
                            />
                          </label>
                          {!videoFile &&
                          editingId &&
                            posts.find((post) => post.id === editingId)?.video &&
                            posts.find((post) => post.id === editingId)?.video
                              ?.type !== "youtube" ? (
                            <p>
                              Hozirgi video:{" "}
                              {
                                posts.find((post) => post.id === editingId)
                                  .video.name
                              }
                            </p>
                          ) : !videoFile ? (
                            <p>Video Supabase umumiy xotirasiga yuklanadi.</p>
                          ) : null}
                        </div>
                      )}
                      {!videoMode && (
                        <p>YouTube havolasini kiriting yoki video fayl tanlang.</p>
                      )}
                    </div>
                    <div className="admin-form-actions">
                      <button
                        className="admin-submit"
                        disabled={Boolean(storageError) || isSavingPost}
                        type="submit"
                      >
                        {isSavingPost
                          ? "Saqlanmoqda…"
                          : editingId
                            ? "O‘zgarishlarni saqlash"
                            : "Blogga joylash"}
                      </button>
                      <button
                        className="admin-cancel"
                        onClick={closeEditor}
                        type="button"
                      >
                        Bekor qilish
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="admin-post-list">
                    {posts.length ? (
                      posts.map((post) => (
                        <article className="admin-post" key={post.id}>
                          <span>{post.date}</span>
                          <h3>{post.title}</h3>
                          <p>{post.summary}</p>
                          <div className="admin-post-actions">
                            <button
                              className="admin-cancel"
                              onClick={() => startEditing(post)}
                              type="button"
                            >
                              Tahrirlash
                            </button>
                            <button
                              className="admin-delete"
                              onClick={() => deletePost(post.id)}
                              type="button"
                            >
                              O‘chirish
                            </button>
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="admin-empty">
                        Hali maqola yo‘q. Birinchi maqolani qo‘shing.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

export default AdminPortal;
