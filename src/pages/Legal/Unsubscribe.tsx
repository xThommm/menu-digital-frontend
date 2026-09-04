import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import styles from "./Legal.module.css";

type BajaForm = {
  email: string;
  username: string;
};

type BajaErrors = {
  email?: string;
  username?: string;
  form?: string;
};

type Step = "form" | "confirm" | "success";

export default function Baja() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [form, setForm] = useState<BajaForm>({
    email: "",
    username: "",
  });
  const [errors, setErrors] = useState<BajaErrors>({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [codigo, setCodigo] = useState("");

  // ── Paso 2: confirmación por código ──
  const [requestId, setRequestId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (name in errors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name as keyof BajaErrors];
        return next;
      });
    }
  };

  const validate = (): BajaErrors => {
    const newErrors: BajaErrors = {};

    if (!form.email.trim() && !form.username.trim()) {
      newErrors.form = "Ingresá el email o el nombre de usuario de la cuenta";
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Ingresá un email válido";
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
      const res = await fetch("/api/payments/baja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim() || undefined,
          username: form.username.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({
          form: data.message || "No se pudo procesar la solicitud.",
        });
        return;
      }

      setRequestId(data.requestId);
      setMaskedEmail(data.maskedEmail || "");
      setStep("confirm");
    } catch {
      setErrors({
        form: "Ocurrió un error al enviar la solicitud. Intentá de nuevo o escribinos a menudigitalappsoporte@gmail.com",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();

    if (!/^\d{6}$/.test(code.trim())) {
      setCodeError("Ingresá el código de 6 dígitos que te enviamos por email.");
      return;
    }

    setConfirming(true);
    setCodeError("");

    try {
      const res = await fetch("/api/payments/baja/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCodeError(data.message || "No se pudo confirmar la baja.");
        return;
      }

      setCodigo(data.codigo);
      setStep("success");
    } catch {
      setCodeError("Ocurrió un error al confirmar. Intentá de nuevo o escribinos a menudigitalappsoporte@gmail.com");
    } finally {
      setConfirming(false);
    }
  };

  const volverAlFormulario = () => {
    setStep("form");
    setCode("");
    setCodeError("");
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
            <em>Baja de Servicio</em>
          </h1>
          <p className={styles.subtitle}>
            Rescisión · Art. 10 ter Ley 24.240
          </p>
        </div>
      </div>

      <main className={styles.main}>
        <div className={styles.container}>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>¿Qué es la baja del servicio?</h2>
            <p>
              De conformidad con el artículo 10 ter de la Ley N° 24.240 de Defensa del
              Consumidor, podés solicitar la <strong>rescisión del servicio</strong> en
              cualquier momento, a través del mismo medio utilizado para la contratación
              (canales digitales).
            </p>
            <p>
              La baja implica que tu cuenta pasa al <strong>plan Gratis</strong>. No genera
              reembolso del período ya abonado. Si estás dentro de los 10 días corridos
              desde el pago y querés recuperar el dinero, usá el{" "}
              <Link to="/arrepentimiento" className={styles.link}>
                Botón de Arrepentimiento
              </Link>
              .
            </p>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Importante</h2>
            <ul className={styles.list}>
              <li>La baja puede solicitarse en cualquier momento.</li>
              <li>Por seguridad, te vamos a pedir que confirmes con un código que mandamos al email de la cuenta.</li>
              <li>Tu cuenta pasa al plan Gratis al confirmarse la solicitud.</li>
              <li>No se reembolsa el período ya pagado (salvo ejercicio del derecho de arrepentimiento).</li>
              <li>El contenido de tu menú se conserva; solo se aplican los límites del plan Gratis.</li>
            </ul>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Solicitar baja del servicio</h2>

            {step === "success" ? (
              <div className={styles.successBox}>
                <div className={styles.successIcon}>✓</div>
                <h3 className={styles.successTitle}>Baja registrada</h3>
                <p className={styles.successText}>
                  Tu solicitud de baja fue procesada correctamente.
                  <br /><br />
                  <strong>Código de identificación:</strong>
                  <br />
                  <span style={{ color: "var(--auth-amber)", letterSpacing: "0.05em" }}>
                    {codigo}
                  </span>
                  <br /><br />
                  Tu cuenta ya está en el plan Gratis. Guardá este código por si lo necesitás.
                </p>
                <Link
                  to="/"
                  className={styles.btnPrimary}
                  style={{ marginTop: "1rem", textDecoration: "none" }}
                >
                  Volver al inicio
                </Link>
              </div>
            ) : step === "confirm" ? (
              <div className={styles.formWrap}>
                <form className={styles.form} onSubmit={handleConfirm} noValidate>
                  {codeError && <div className={styles.errorBox}>{codeError}</div>}

                  <p className={styles.successText} style={{ marginBottom: "0.5rem" }}>
                    Te enviamos un código de 6 dígitos a{" "}
                    <strong>{maskedEmail || "tu email"}</strong>. Ingresalo para confirmar la baja.
                  </p>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="code">
                      Código de confirmación
                    </label>
                    <input
                      id="code"
                      name="code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className={`${styles.input} ${codeError ? styles.inputError : ""}`}
                      placeholder="123456"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                        setCodeError("");
                      }}
                      disabled={confirming}
                      autoComplete="one-time-code"
                    />
                  </div>

                  <button type="submit" className={styles.btnPrimary} disabled={confirming}>
                    {confirming ? (
                      <>
                        <span className="btnSpinnerDark" />
                        Confirmando...
                      </>
                    ) : (
                      "Confirmar baja del servicio"
                    )}
                  </button>

                  <button
                    type="button"
                    className={styles.link}
                    style={{ background: "none", border: "none", cursor: "pointer", marginTop: "0.75rem" }}
                    onClick={volverAlFormulario}
                    disabled={confirming}
                  >
                    ¿No te llegó el código? Volver a intentar
                  </button>
                </form>
              </div>
            ) : (
              <div className={styles.formWrap}>
                <form className={styles.form} onSubmit={handleSubmit} noValidate>
                  {errors.form && (
                    <div className={styles.errorBox}>{errors.form}</div>
                  )}

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="email">
                      Email de la cuenta
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
                    {errors.email && (
                      <span className={styles.errorMsg}>{errors.email}</span>
                    )}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="username">
                      Nombre de usuario (opcional si ya pusiste el email)
                    </label>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      className={styles.input}
                      placeholder="ej: milocal"
                      value={form.username}
                      onChange={handleChange}
                      disabled={loading}
                      autoComplete="username"
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
                        Procesando...
                      </>
                    ) : (
                      "Solicitar baja del servicio"
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
              Si tenés problemas o preferís hacerlo por correo, escribinos a{" "}
              <a
                href="mailto:menudigitalappsoporte@gmail.com"
                className={styles.link}
              >
                menudigitalappsoporte@gmail.com
              </a>{" "}
              indicando que querés dar de baja el servicio, tu email y/o nombre de usuario.
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
            <Link to="/baja">Botón de Baja</Link>
            <Link to="/contacto">Contacto</Link>
          </div>
          <span className={styles.footCopy}>
            © 2026 MenuDigitalApp. Hecho en Argentina 🇦🇷
          </span>
        </div>
      </footer>
    </div>
  );
}
