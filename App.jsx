import React, { useEffect, useState } from "react";
import AdminPortal from "./AdminPortal.jsx";
import { loadImageFile, loadVideoFile } from "./videoStorage.js";
import {
  isRegistrationSettings,
  normalizeTelegramBotUrl,
  REGISTRATION_STORAGE_KEY,
} from "./registrationSettings.js";
import { fetchPosts, isSupabaseConfigured } from "./supabase.js";

const PROGRAMS_STORAGE_KEY = "yashil-texnikum-programs-v1";
const PHONE_NUMBERS_STORAGE_KEY = "yashil-texnikum-phone-numbers-v1";

const initialPrograms = [
  {
    number: "01",
    title: "Ekologiya",
    description:
      "Atrof-muhit va tabiiy resurslarni muhofaza qilishga oid kasbiy yo‘nalish.",
    icon: "✳",
  },
  {
    number: "02",
    title: "O‘rmon xo‘jaligi",
    description:
      "O‘rmon xo‘jaligi sohasida bilim va amaliy ko‘nikmalar olish yo‘nalishi.",
    icon: "♧",
  },
  {
    number: "03",
    title: "Laborant-ekolog",
    description:
      "Ekologik laboratoriya va nazorat ishlariga oid kasbiy tayyorgarlik.",
    icon: "⌕",
  },
  {
    number: "04",
    title: "Melioratsiya texnikasi operatori",
    description:
      "Melioratsiya texnikasini boshqarishga oid kasbiy yo‘nalish.",
    icon: "↗",
  },
  {
    number: "05",
    title: "Agrotexnika mashinisti",
    description:
      "Qishloq xo‘jaligi texnikasida ishlashga oid kasbiy yo‘nalish.",
    icon: "✳",
  },
  {
    number: "06",
    title: "Grafika va dizayn",
    description:
      "Grafik dizayn va vizual materiallar tayyorlash yo‘nalishi.",
    icon: "◈",
  },
  {
    number: "07",
    title: "Moda va tikuvchilik",
    description:
      "Moda va tikuvchilik sohasiga oid kasbiy yo‘nalish.",
    icon: "✂",
  },
];

const initialPhoneNumbers = [
  "+998 97 908 88 18",
  "+998 90 153 30 17",
  "+998 93 841 01 11",
];

function BlogImage({ image, title }) {
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState("");

  useEffect(() => {
    if (image?.type !== "file") {
      return undefined;
    }

    setImageUrl("");
    setImageError("");
    let active = true;
    let objectUrl = "";
    loadImageFile(image.id)
      .then((file) => {
        if (!active) {
          return;
        }
        if (!file) {
          setImageError("Bu brauzerda rasm fayli topilmadi.");
          return;
        }
        objectUrl = URL.createObjectURL(file);
        setImageUrl(objectUrl);
      })
      .catch((error) => {
        console.error("Could not load a blog image.", error);
        if (active) {
          setImageError("Maqola rasmini yuklab bo‘lmadi.");
        }
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [image?.id, image?.type]);

  if (image?.type === "remote" && image.url) {
    return <img className="blog-image" src={image.url} alt={title} />;
  }
  if (image?.type !== "file") {
    return null;
  }
  if (imageError) {
    return <p className="blog-media-error">{imageError}</p>;
  }
  return imageUrl ? (
    <img className="blog-image" src={imageUrl} alt={title} />
  ) : (
    <p className="blog-media-loading">Rasm yuklanmoqda…</p>
  );
}

function BlogVideo({ video, title }) {
  const [fileUrl, setFileUrl] = useState("");
  const [videoError, setVideoError] = useState("");

  useEffect(() => {
    if (video?.type !== "file") {
      return undefined;
    }

    setFileUrl("");
    setVideoError("");
    let active = true;
    let objectUrl = "";
    loadVideoFile(video.id)
      .then((file) => {
        if (!active) {
          return;
        }
        if (!file) {
          setVideoError("Bu brauzerda video fayl topilmadi.");
          return;
        }
        objectUrl = URL.createObjectURL(file);
        setFileUrl(objectUrl);
      })
      .catch((error) => {
        console.error("Could not load a blog video.", error);
        if (active) {
          setVideoError("Videoni yuklab bo‘lmadi.");
        }
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [video?.id, video?.type]);

  if (video?.type === "youtube" && /^[\w-]{11}$/.test(video.videoId)) {
    return (
      <div className="blog-video">
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          src={`https://www.youtube-nocookie.com/embed/${video.videoId}`}
          title={`${title} — video`}
        />
      </div>
    );
  }

  if (video?.type === "file") {
    if (videoError) {
      return <p className="blog-video-error">{videoError}</p>;
    }
    return fileUrl ? (
      <div className="blog-video">
        <video
          className="blog-video-file"
          controls
          preload="metadata"
          src={fileUrl}
        >
          Brauzeringiz videoni o‘ynata olmaydi.
        </video>
      </div>
    ) : (
      <p className="blog-video-loading">Video yuklanmoqda…</p>
    );
  }

  if (video?.type === "remote" && video.url) {
    return (
      <div className="blog-video">
        <video
          className="blog-video-file"
          controls
          preload="metadata"
          src={video.url}
        >
          Brauzeringiz videoni o‘ynata olmaydi.
        </video>
      </div>
    );
  }

  return null;
}

function BlogSection({ posts, postsLoaded, storageError }) {
  return (
    <section className="blog" id="blog">
      <div className="blog-heading">
        <div>
          <div className="section-label">
            <span>03</span> / YANGILIKLAR
          </div>
          <h2>Texnikum hayotidan.</h2>
        </div>
        <p>Yangiliklar, tadbirlar va o‘quvchilar yutuqlari.</p>
      </div>
      {storageError ? (
        <p className="blog-empty">{storageError}</p>
      ) : !postsLoaded ? (
        <p className="blog-empty">Maqolalar yuklanmoqda…</p>
      ) : posts.length ? (
        <div className="blog-grid">
          {posts.map((post) => (
            <article className="blog-card" key={post.id}>
              <span className="blog-date">{post.date}</span>
              <h3>{post.title}</h3>
              {post.image && <BlogImage image={post.image} title={post.title} />}
              <p className="blog-summary">{post.summary}</p>
              <p className="blog-body">{post.body}</p>
              {post.video && <BlogVideo video={post.video} title={post.title} />}
            </article>
          ))}
        </div>
      ) : (
        <p className="blog-empty">
          Hozircha yangiliklar yo‘q. Yangi maqolalar shu yerda chiqadi.
        </p>
      )}
    </section>
  );
}

function LeafMark() {
  return (
    <svg
      aria-hidden="true"
      className="brand-mark"
      viewBox="0 0 40 40"
      fill="none"
    >
      <path
        d="M32.8 7.2C20.4 7.6 10.1 10.6 8.2 20.1c-1.1 5.3 2.4 9.2 7.2 8.6 9.1-1.2 12.8-12.1 17.4-21.5Z"
        fill="currentColor"
      />
      <path
        d="M7.5 33c3.4-8.5 9.5-13.9 18.1-17.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function App() {
  const [adminOpen, setAdminOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [programs, setPrograms] = useState(initialPrograms);
  const [programsLoaded, setProgramsLoaded] = useState(false);
  const [programStorageError, setProgramStorageError] = useState("");
  const [registrationSettings, setRegistrationSettings] = useState({
    url: "",
    enabled: false,
  });
  const [registrationLoaded, setRegistrationLoaded] = useState(false);
  const [registrationStorageError, setRegistrationStorageError] = useState("");
  const [phoneNumbers, setPhoneNumbers] = useState(initialPhoneNumbers);
  const [phoneNumbersLoaded, setPhoneNumbersLoaded] = useState(false);
  const [phoneStorageError, setPhoneStorageError] = useState("");
  const registrationUrl = normalizeTelegramBotUrl(registrationSettings.url);

  useEffect(() => {
    let active = true;
    fetchPosts()
      .then((savedPosts) => {
        if (active) {
          setPosts(savedPosts);
        }
      })
      .catch((error) => {
        console.error("Could not load blog posts from Supabase.", error);
        if (active) {
          setStorageError(
            isSupabaseConfigured
              ? `Maqolalarni bazadan yuklab bo‘lmadi: ${error.message}`
              : error.message,
          );
        }
      })
      .finally(() => {
        if (active) {
          setPostsLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      const savedPrograms = localStorage.getItem(PROGRAMS_STORAGE_KEY);
      if (savedPrograms) {
        const parsedPrograms = JSON.parse(savedPrograms);
        if (
          !Array.isArray(parsedPrograms) ||
          parsedPrograms.some(
            (program) =>
              !program ||
              typeof program.number !== "string" ||
              typeof program.title !== "string" ||
              typeof program.description !== "string" ||
              typeof program.icon !== "string",
          )
        ) {
          throw new Error("Stored program data is invalid.");
        }
        setPrograms(parsedPrograms);
      }
    } catch (error) {
      console.error("Could not load programs from this browser.", error);
      setProgramStorageError(
        "Brauzerda saqlangan yo‘nalishlarni o‘qib bo‘lmadi.",
      );
    } finally {
      setProgramsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!programsLoaded || programStorageError) {
      return;
    }
    try {
      localStorage.setItem(PROGRAMS_STORAGE_KEY, JSON.stringify(programs));
    } catch (error) {
      console.error("Could not save programs in this browser.", error);
      setProgramStorageError(
        "Yo‘nalishlarni ushbu brauzerda saqlab bo‘lmadi.",
      );
    }
  }, [programs, programsLoaded, programStorageError]);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(REGISTRATION_STORAGE_KEY);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        if (!isRegistrationSettings(parsedSettings)) {
          throw new Error("Stored registration settings are invalid.");
        }
        setRegistrationSettings(parsedSettings);
      }
    } catch (error) {
      console.error("Could not load registration settings.", error);
      setRegistrationStorageError(
        "Ro‘yxatdan o‘tish tugmasi sozlamalarini o‘qib bo‘lmadi.",
      );
    } finally {
      setRegistrationLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!registrationLoaded || registrationStorageError) {
      return;
    }
    try {
      localStorage.setItem(
        REGISTRATION_STORAGE_KEY,
        JSON.stringify(registrationSettings),
      );
    } catch (error) {
      console.error("Could not save registration settings.", error);
      setRegistrationStorageError(
        "Ro‘yxatdan o‘tish tugmasi sozlamalarini saqlab bo‘lmadi.",
      );
    }
  }, [registrationSettings, registrationLoaded, registrationStorageError]);

  useEffect(() => {
    try {
      const savedPhoneNumbers = localStorage.getItem(
        PHONE_NUMBERS_STORAGE_KEY,
      );
      if (savedPhoneNumbers) {
        const parsedPhoneNumbers = JSON.parse(savedPhoneNumbers);
        if (
          !Array.isArray(parsedPhoneNumbers) ||
          parsedPhoneNumbers.some((phone) => typeof phone !== "string")
        ) {
          throw new Error("Stored phone numbers are invalid.");
        }
        setPhoneNumbers(parsedPhoneNumbers);
      }
    } catch (error) {
      console.error("Could not load contact phone numbers.", error);
      setPhoneStorageError(
        "Brauzerda saqlangan telefon raqamlarini o‘qib bo‘lmadi.",
      );
    } finally {
      setPhoneNumbersLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!phoneNumbersLoaded || phoneStorageError) {
      return;
    }
    try {
      localStorage.setItem(
        PHONE_NUMBERS_STORAGE_KEY,
        JSON.stringify(phoneNumbers),
      );
    } catch (error) {
      console.error("Could not save contact phone numbers.", error);
      setPhoneStorageError(
        "Telefon raqamlarini ushbu brauzerda saqlab bo‘lmadi.",
      );
    }
  }, [phoneNumbers, phoneNumbersLoaded, phoneStorageError]);

  if (adminOpen) {
    return (
      <div className="site-shell admin-shell">
        <AdminPortal
          onClose={() => setAdminOpen(false)}
          posts={posts}
          setPosts={setPosts}
          storageError={storageError}
          programs={programs}
          setPrograms={setPrograms}
          programStorageError={programStorageError}
          registrationSettings={registrationSettings}
          setRegistrationSettings={setRegistrationSettings}
          registrationStorageError={registrationStorageError}
          phoneNumbers={phoneNumbers}
          setPhoneNumbers={setPhoneNumbers}
          phoneStorageError={phoneStorageError}
        />
      </div>
    );
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#bosh-sahifa" aria-label="Bosh sahifa">
          <LeafMark />
          <span>
            <strong>YASHIL</strong>
            <small>TEXNIKUMI</small>
          </span>
        </a>
        <nav className="main-nav" aria-label="Asosiy navigatsiya">
          <a href="#biz-haqimizda">Biz haqimizda</a>
          <a href="#yonalishlar">Yo‘nalishlar</a>
          <a href="#blog">Blog</a>
          <a href="#aloqa">Aloqa</a>
        </nav>
        <a className="header-link" href="#biz-haqimizda">
          Biz bilan tanishing <span aria-hidden="true">↗</span>
        </a>
        {registrationSettings.enabled && registrationUrl && (
          <a
            className="registration-trigger"
            href={registrationUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Texnikumga ro‘yxatdan o‘tish
          </a>
        )}
        <button
          className="admin-trigger"
          onClick={() => setAdminOpen(true)}
          type="button"
        >
          Admin <span aria-hidden="true">↗</span>
        </button>
      </header>

      <main>
        <section className="hero" id="bosh-sahifa">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              SIRDARYO VILOYATI · BOYOVUT TUMANI
            </div>
            <h1>
              Bilim bilan
              <br />
              <span>yashil kelajak</span>
              <br />
              sari.
            </h1>
            <p className="hero-description">
              Sirdaryo viloyati “Yashil” texnikumi — Boyovut tumanida ekologiya,
              kasbiy ta’lim va amaliy ko‘nikmalar sari yangi imkoniyat.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#yonalishlar">
                Yo‘nalishlarni ko‘rish <span aria-hidden="true">→</span>
              </a>
              <a className="text-link" href="#biz-haqimizda">
                Texnikum haqida
              </a>
            </div>
            <div className="hero-note">
              <span className="note-line" />
              <span>Bugungi ta’lim — ertangi imkoniyat</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="Yashil kelajak ramzi">
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <div className="visual-disc">
              <div className="sun" />
              <div className="hill hill-back" />
              <div className="hill hill-front" />
              <div className="plant plant-one">
                <i />
                <i />
                <i />
                <b />
              </div>
              <div className="plant plant-two">
                <i />
                <i />
                <i />
                <b />
              </div>
              <span className="disc-caption">O‘RGAN · YARAT · RIVOJLAN</span>
            </div>
            <div className="floating-card">
              <span className="floating-icon">✳</span>
              <span>
                <strong>Yashil fikr</strong>
                <small>Barqaror kelajak uchun</small>
              </span>
            </div>
            <span className="visual-index">01 — 03</span>
          </div>
        </section>

        <section className="intro" id="biz-haqimizda">
          <div className="section-label">
            <span>01</span> / BIZ HAQIMIZDA
          </div>
          <div className="intro-content">
            <h2>
              Har bir katta
              <br />
              maqsad <em>bilimdan</em>
              <br />
              boshlanadi.
            </h2>
            <p>
              Prezidentning PQ-110-son qarori 1-ilovasida Boyovut tumani
              2-son politexnikumi negizida Sirdaryo viloyati “yashil”
              texnikumini tashkil etish belgilangan. Ta’lim ekologiya, atrof-muhit
              va iqlim o‘zgarishi sohalariga yo‘naltiriladi.
            </p>
          </div>
          <a
            className="source-link"
            href="https://lex.uz/docs/-8100110"
            target="_blank"
            rel="noreferrer"
          >
            Rasmiy qaror: PQ-110, 1-ilova <span aria-hidden="true">↗</span>
          </a>
        </section>

        <section className="programs" id="yonalishlar">
          <div className="programs-heading">
            <div>
              <div className="section-label">
                <span>02</span> / IMKONIYATLAR
              </div>
              <h2>Yashil kelajak kasblari.</h2>
            </div>
            <p>
              Ochiq e’londa ko‘rsatilgan ta’lim yo‘nalishlari. Qabul shartlari
              va joriy ma’lumotlarni texnikum bilan aniqlashtiring.
            </p>
          </div>
          <div className="program-grid">
            {programs.map((program) => (
              <article className="program-card" key={program.number}>
                <div className="card-topline">
                  <span>{program.number}</span>
                  <span className="card-icon" aria-hidden="true">
                    {program.icon}
                  </span>
                </div>
                <h3>{program.title}</h3>
                <p>{program.description}</p>
                <span className="card-arrow" aria-hidden="true">
                  ↗
                </span>
              </article>
            ))}
          </div>
        </section>

        <BlogSection
          posts={posts}
          postsLoaded={postsLoaded}
          storageError={storageError}
        />

        <section className="contact" id="aloqa">
          <div className="section-label">
            <span>04</span> / ALOQA
          </div>
          <div className="contact-content">
            <div>
              <h2>Ma’lumot uchun bog‘laning.</h2>
              <p>
                Quyidagi telefon raqamlari 2026-yil 1-iyuldagi ochiq e’londa
                berilgan. Raqamlarning amaldaligini qo‘ng‘iroq orqali tekshirib
                oling.
              </p>
              <a
                className="source-link"
                href="https://www.instagram.com/reel/DaP71HnIPdJ/"
                target="_blank"
                rel="noreferrer"
              >
                Manba: Boyovut Ovozi <span aria-hidden="true">↗</span>
              </a>
            </div>
            <div className="phone-list">
              {phoneNumbers.map((phone) => (
                <a
                  href={`tel:${phone.startsWith("+") ? "+" : ""}${phone.replace(/\D/g, "")}`}
                  key={phone}
                >
                  {phone} <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#bosh-sahifa">
          <LeafMark />
          <span>
            <strong>YASHIL</strong>
            <small>TEXNIKUMI</small>
          </span>
        </a>
        <p>Boyovut tumani, Sirdaryo viloyati, O‘zbekiston</p>
        <a className="footer-top" href="#bosh-sahifa">
          Bosh sahifaga <span aria-hidden="true">↑</span>
        </a>
      </footer>
    </div>
  );
}

export default App;
