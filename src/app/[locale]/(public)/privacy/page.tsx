import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{t("privacyTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("draftNotice")}</p>
      {locale === "he" ? (
        <div className="space-y-3 text-sm leading-6">
          <p>מערכת תיאום החדרים נועדה למטפלים שאושרו בידי בעלי המתחמים, לצורך תיאום השימוש בחדרי הטיפול.</p>
          <p>
            המידע הנשמר: שם מלא, כתובת דוא״ל, שפה מועדפת, חברות במתחמים והזמנות חדרים (מתחם, חדר, תאריך ושעה, הערה
            תפעולית). המערכת אינה שומרת פרטי מטופלים ואין להזין פרטי מטופלים בשדה ההערה.
          </p>
          <p>
            המידע משמש לניהול ההזמנות, לשליחת הודעות תפעוליות בדוא״ל ולהפקת דוחות שימוש לבעלי המתחמים. המידע אינו מועבר
            לצדדים שלישיים למעט ספקי התשתית (אירוח, מסד נתונים, שליחת דוא״ל) הנדרשים להפעלת השירות.
          </p>
          <p>
            ניתן לבקש מחיקת חשבון. במחיקה הפרטים המזהים מוסרים, ורשומות ההזמנות והביקורת נשמרות בצורה אנונימית לצורכי
            תפעול.
          </p>
          <p>לשאלות בנושא פרטיות יש לפנות לבעלי המתחם.</p>
        </div>
      ) : (
        <div className="space-y-3 text-sm leading-6">
          <p>
            The room scheduler is intended for therapists approved by the site owners, to coordinate the use of therapy
            rooms.
          </p>
          <p>
            Data stored: full name, email address, preferred language, site memberships and room bookings (site, room,
            date and time, operational note). The system does not store patient details, and patient details must not be
            entered in the note field.
          </p>
          <p>
            The data is used to manage bookings, send operational emails and produce usage reports for the site owners.
            It is not shared with third parties except infrastructure providers (hosting, database, email delivery)
            required to run the service.
          </p>
          <p>
            You may request account deletion. Identifying details are removed; booking and audit records are kept
            anonymised for operational purposes.
          </p>
          <p>For privacy questions contact the site owners.</p>
        </div>
      )}
    </main>
  );
}
