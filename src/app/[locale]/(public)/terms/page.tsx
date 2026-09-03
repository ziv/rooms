import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{t("termsTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("draftNotice")}</p>
      {locale === "he" ? (
        <div className="space-y-3 text-sm leading-6">
          <p>
            השימוש במערכת מותר למטפלים שאושרו בידי בעלי המתחמים בלבד. בעלי המתחמים רשאים לאשר, לדחות או להשעות חברות בכל
            עת.
          </p>
          <p>
            הזמנת חדר מהווה התחייבות לשימוש במשבצת. ניתן לשנות או לבטל הזמנה עד שעת ההתחלה, אלא אם נקבע אחרת בהגדרות
            המתחם.
          </p>
          <p>אין להזין במערכת פרטי מטופלים או מידע רפואי.</p>
          <p>בעלי המתחמים רשאים לשנות, להעביר או לבטל הזמנות לצורכי תפעול; על כל שינוי כזה נשלחת הודעה.</p>
          <p>המערכת מסופקת כפי שהיא. בעלי המתחמים אינם אחראים לנזק הנובע מתקלה או מאי-זמינות של המערכת.</p>
        </div>
      ) : (
        <div className="space-y-3 text-sm leading-6">
          <p>
            Use of the system is permitted only to therapists approved by the site owners. The site owners may approve,
            reject or suspend a membership at any time.
          </p>
          <p>
            A room booking is a commitment to use the slot. A booking may be changed or cancelled until its start time
            unless the site settings say otherwise.
          </p>
          <p>Patient details or medical information must not be entered into the system.</p>
          <p>
            The site owners may change, move or cancel bookings for operational reasons; a notification is sent for
            every such change.
          </p>
          <p>
            The system is provided as is. The site owners are not liable for damages resulting from a malfunction or
            unavailability of the system.
          </p>
        </div>
      )}
    </main>
  );
}
