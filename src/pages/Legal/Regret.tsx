import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import styles from "./Legal.module.css";

type FormState = {
  email: string;
  orderId: string;
  motivo: string;
};

type FormErrors = {
  email?: string;
  orderId?: string;
  form?: string;
};

export default function Arrepentimiento() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [form, setForm] = useState<FormState>({
    email: "",
    orderId: "",
    motivo: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [codigo, setCodigo] = useState("");

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (name in errors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name as keyof FormErrors];
        return next;
      });
    }
  };

  const validate = (): FormErrors => {
    const newErrors: FormErrors = {};

    if (!form.email.trim()) {
      newErrors.email = "Ingresá el email con el que realizaste la compra";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Ingresá un email válido";
    }

    if (!form.orderId.trim()) {
      newErrors.orderId =
        "Ingresá el número de operación de Mercado Pago o el email de la cuenta";
    }

    return newErrors;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const res = await fetch("/api/payments/arrepentimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          orderId: form.orderId.trim(),
          motivo: form.motivo.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({
          form: data.message || "No se pudo procesar la solicitud.",
        });
        return;
      }

      setCodigo(data.codigo);
      setSuccess(true);
    } catch {
      setErrors({
        form: "Ocurrió un error al enviar la solicitud. Intentá de nuevo o escribinos a menudigitalappsoporte@gmail.com",
      });
    } finally {
      setLoading(false);
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
          <div className={styles.eyebrow}>Legal</div>
          <h1 className={styles.title}>
            Botón de<br />
            <em>Arrepentimiento</em>
          </h1>
          <p className={styles.subtitle}>
            Derecho de revocación · Ley 24.240
          </p>
        </div>
      </div>

      <main className={styles.main}>
        <div className={styles.container}>

          {/* ─── Información legal ─── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>¿Qué es el derecho de arrepentimiento?</h2>
            <p>
              De conformidad con el artículo 34 de la Ley N° 24.240 de Defensa del Consumidor
              y el artículo 1110 del Código Civil y Comercial de la Nación, tenés derecho a
              <strong> revocar la aceptación</strong> de la contratación de un plan pago dentro
              de los <strong>diez (10) días corridos</strong> contados desde la fecha de
              celebración del contrato (aprobación del pago), sin necesidad de justificar el
              motivo y sin costo alguno.
            </p>
            <p>
              Una vez recibida tu solicitud, te enviaremos un <strong>código de identificación</strong> del
              trámite dentro de las 24 horas y procederemos al reembolso por el mismo medio de pago utilizado.
            </p>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Importante</h2>
            <ul className={styles.list}>
              <li>El plazo de 10 días corridos se cuenta desde la aprobación del pago por Mercado Pago.</li>
              <li>No es necesario justificar el motivo del arrepentimiento.</li>
              <li>El reembolso se realiza por el mismo medio de pago utilizado.</li>
              <li>
                Este derecho no aplica cuando el servicio ya haya sido utilizado de manera
                significativa (por ejemplo, publicación activa del menú digital y generación
                de códigos QR en producción), conforme al artículo 1116 del Código Civil y Comercial.
              </li>
            </ul>
          </section>

          <div className={styles.divider} />

          {/* ─── Formulario ─── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Solicitar arrepentimiento</h2>

            {success ? (
              <div className={styles.successBox}>
                <div className={styles.successIcon}>✓</div>
                <h3 className={styles.successTitle}>Solicitud recibida</h3>
                <p className={styles.successText}>
                  Tu pedido de arrepentimiento fue registrado correctamente.
                  <br /><br />
                  <strong>Código de identificación:</strong>
                  <br />
                  <span style={{ color: "var(--auth-amber)", letterSpacing: "0.05em" }}>
                    {codigo}
                  </span>
                  <br /><br />
                  Guardá este código. Te responderemos dentro de las 24 horas al email indicado.
                </p>
                <Link to="/" className={styles.btnPrimary} style={{ marginTop: "1rem", textDecoration: "none" }}>
                  Volver al inicio
                </Link>
              </div>
            ) : (
              <div className={styles.formWrap}>
                <form className={styles.form} onSubmit={handleSubmit} noValidate>
                  {errors.form && (
                    <div className={styles.errorBox}>{errors.form}</div>
                  )}

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="email">
                      Email de la compra *
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
                      placeholder="ej: tu@email.com"
                      value={form.email}
                      onChange={handleChange}
                      disabled={loading}
                      autoComplete="email"
                    />
                    {errors.email && <span className={styles.errorMsg}>{errors.email}</span>}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="orderId">
                      Número de operación de Mercado Pago o email de la cuenta *
                    </label>
                    <input
                      id="orderId"
                      name="orderId"
                      type="text"
                      className={`${styles.input} ${errors.orderId ? styles.inputError : ""}`}
                      placeholder="Ej: 1234567890 o el email de tu cuenta"
                      value={form.orderId}
                      onChange={handleChange}
                      disabled={loading}
                    />
                    {errors.orderId && <span className={styles.errorMsg}>{errors.orderId}</span>}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="motivo">
                      Motivo (opcional)
                    </label>
                    <textarea
                      id="motivo"
                      name="motivo"
                      className={`${styles.input} ${styles.textarea}`}
                      placeholder="Si querés, podés contarnos el motivo (no es obligatorio)"
                      value={form.motivo}
                      onChange={handleChange}
                      disabled={loading}
                      rows={4}
                    />
                  </div>

                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="btnSpinnerDark" />
                        Enviando...
                      </>
                    ) : (
                      "Enviar solicitud de arrepentimiento"
                    )}
                  </button>
                </form>
              </div>
            )}
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>¿Necesitás ayuda?</h2>
            <p>
              Si tenés problemas para completar el formulario o preferís hacerlo por correo,
              escribinos a{" "}
              <a href="mailto:menudigitalappsoporte@gmail.com" className={styles.link}>
                menudigitalappsoporte@gmail.com
              </a>
              {" "}indicando que querés ejercer el derecho de arrepentimiento, tu email de compra
              y el número de operación.
            </p>
          </section>

        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footInner}>
          <span className={styles.footLogo}>Menú Digital</span>
          <div className={styles.footLinks}>
            <Link to="/terminos">Términos</Link>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/arrepentimiento">Botón de Arrepentimiento</Link>
            <Link to="/baja">Botón de Baja de Servicio</Link>
            <Link to="/contacto">Contacto</Link>
          </div>
          <span className={styles.footCopy}>© 2026 MenuDigitalApp. Hecho en Argentina 🇦🇷</span>
        </div>
      </footer>
    </div>
  );
}