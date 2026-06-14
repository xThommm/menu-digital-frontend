import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import styles from "./Legal.module.css";

type FormState = "idle" | "sending" | "success" | "error";

export default function Contact() {
  const [formState, setFormState] = useState<FormState>("idle");
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const validate = () => {
    const e: Partial<typeof form> = {};
    if (!form.name.trim()) e.name = "El nombre es obligatorio";
    if (!form.email.trim()) e.email = "El email es obligatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email inválido";
    if (!form.subject.trim()) e.subject = "El asunto es obligatorio";
    if (!form.message.trim()) e.message = "El mensaje es obligatorio";
    else if (form.message.trim().length < 20) e.message = "El mensaje debe tener al menos 20 caracteres";
    return e;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof typeof form]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setFormState("sending");

    try {
      // Envío usando mailto como fallback confiable
      // Si tenés EmailJS o un endpoint propio, reemplazá este bloque
      const body = encodeURIComponent(
        `Nombre: ${form.name}\nEmail: ${form.email}\nAsunto: ${form.subject}\n\nMensaje:\n${form.message}`
      );
      const mailtoUrl = `mailto:thomlucasdev@gmail.com?subject=${encodeURIComponent(`[Contacto Web] ${form.subject}`)}&body=${body}`;
      window.location.href = mailtoUrl;

      // Simulamos éxito luego de abrir el cliente de mail
      setTimeout(() => {
        setFormState("success");
        setForm({ name: "", email: "", subject: "", message: "" });
      }, 800);
    } catch {
      setFormState("error");
    }
  };

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.navLogo}>
          Menú<span> Digital</span>
        </Link>
        <Link to="/" className={styles.navBack}>
          ← Volver al inicio
        </Link>
      </nav>

      <div className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroGrid} />
        <div className={styles.heroContent}>
          <div className={styles.eyebrow}>Escribinos</div>
          <h1 className={styles.title}>
            Estamos para<br />
            <em>ayudarte.</em>
          </h1>
          <p className={styles.subtitle}>
            Respondemos en menos de 24 horas hábiles.
          </p>
        </div>
      </div>

      <main className={styles.main}>
        <div className={styles.contactGrid}>

          {/* ── INFO ── */}
          <div className={styles.contactInfo}>
            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>✉️</div>
              <div className={styles.infoTitle}>Email</div>
              <a href="mailto:thomlucasdev@gmail.com" className={styles.link}>
                thomlucasdev@gmail.com
              </a>
            </div>
            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>🕐</div>
              <div className={styles.infoTitle}>Horario de soporte</div>
              <p className={styles.infoText}>Lunes a viernes<br />9:00 – 18:00 (ARG)</p>
            </div>
            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>📍</div>
              <div className={styles.infoTitle}>Ubicación</div>
              <p className={styles.infoText}>Ciudad Autónoma de Buenos Aires<br />Argentina 🇦🇷</p>
            </div>
            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>⚡</div>
              <div className={styles.infoTitle}>Soporte urgente</div>
              <p className={styles.infoText}>
                Los clientes con plan activo reciben atención prioritaria por WhatsApp.
              </p>
            </div>
          </div>

          {/* ── FORMULARIO ── */}
          <div className={styles.formWrap}>
            {formState === "success" ? (
              <div className={styles.successBox}>
                <div className={styles.successIcon}>✓</div>
                <h3 className={styles.successTitle}>¡Mensaje enviado!</h3>
                <p className={styles.successText}>
                  Tu cliente de correo se abrió con el mensaje listo. Si no se abrió automáticamente,
                  escribinos directamente a{" "}
                  <a href="mailto:thomlucasdev@gmail.com" className={styles.link}>
                    thomlucasdev@gmail.com
                  </a>
                </p>
                <button
                  className={styles.btnPrimary}
                  onClick={() => setFormState("idle")}
                >
                  Enviar otro mensaje
                </button>
              </div>
            ) : (
              <div className={styles.form}>
                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>Nombre</label>
                    <input
                      className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
                      type="text"
                      name="name"
                      placeholder="Tu nombre"
                      value={form.name}
                      onChange={handleChange}
                      disabled={formState === "sending"}
                    />
                    {errors.name && <span className={styles.errorMsg}>{errors.name}</span>}
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Email</label>
                    <input
                      className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
                      type="email"
                      name="email"
                      placeholder="tu@email.com"
                      value={form.email}
                      onChange={handleChange}
                      disabled={formState === "sending"}
                    />
                    {errors.email && <span className={styles.errorMsg}>{errors.email}</span>}
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Asunto</label>
                  <select
                    className={`${styles.input} ${styles.select} ${errors.subject ? styles.inputError : ""}`}
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                    disabled={formState === "sending"}
                  >
                    <option value="">Seleccioná un asunto</option>
                    <option value="Consulta sobre planes">Consulta sobre planes</option>
                    <option value="Soporte técnico">Soporte técnico</option>
                    <option value="Problema con el pago">Problema con el pago</option>
                    <option value="Cancelación de suscripción">Cancelación de suscripción</option>
                    <option value="Sugerencia">Sugerencia</option>
                    <option value="Otro">Otro</option>
                  </select>
                  {errors.subject && <span className={styles.errorMsg}>{errors.subject}</span>}
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Mensaje</label>
                  <textarea
                    className={`${styles.input} ${styles.textarea} ${errors.message ? styles.inputError : ""}`}
                    name="message"
                    placeholder="Contanos en qué podemos ayudarte..."
                    value={form.message}
                    onChange={handleChange}
                    disabled={formState === "sending"}
                    rows={6}
                  />
                  {errors.message && <span className={styles.errorMsg}>{errors.message}</span>}
                </div>

                {formState === "error" && (
                  <div className={styles.errorBox}>
                    Hubo un problema al enviar el mensaje. Intentá de nuevo o escribinos directamente a{" "}
                    <a href="mailto:thomlucasdev@gmail.com" className={styles.link}>
                      thomlucasdev@gmail.com
                    </a>
                  </div>
                )}

                <button
                  className={styles.btnPrimary}
                  onClick={handleSubmit}
                  disabled={formState === "sending"}
                >
                  {formState === "sending" ? (
                    <><span className={styles.spinner} /> Enviando...</>
                  ) : (
                    "Enviar mensaje →"
                  )}
                </button>
              </div>
            )}
          </div>

        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footInner}>
          <span className={styles.footLogo}>Menú Digital</span>
          <div className={styles.footLinks}>
            <Link to="/terminos">Términos</Link>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/contacto">Contacto</Link>
          </div>
          <span className={styles.footCopy}>© 2026 MenuDigitalApp. Hecho en Argentina 🇦🇷</span>
        </div>
      </footer>
    </div>
  );
}
