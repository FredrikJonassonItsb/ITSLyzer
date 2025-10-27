/**
 * Internationalisering (i18n) för Outlook-tillägget
 */

const translations = {
  'sv-SE': {
    // Allmänt
    'app.title': 'Nextcloud Talk för Outlook',
    'app.loading': 'Laddar...',
    'app.error': 'Ett fel uppstod',
    
    // Autentisering
    'auth.login': 'Logga in',
    'auth.logout': 'Logga ut',
    'auth.loginRequired': 'Du måste logga in för att använda denna funktion',
    'auth.loginButton': 'Logga in med Nextcloud',
    'auth.loggingIn': 'Loggar in...',
    'auth.loginSuccess': 'Inloggning lyckades!',
    'auth.loginError': 'Inloggning misslyckades. Försök igen.',
    'auth.tokenRefreshError': 'Kunde inte förnya inloggning. Logga in igen.',
    
    // Möten
    'meeting.create': 'Skapa Talk-möte',
    'meeting.creating': 'Skapar möte...',
    'meeting.created': 'Talk-möte skapat!',
    'meeting.error': 'Kunde inte skapa möte',
    'meeting.title': 'Mötestitel',
    'meeting.start': 'Starttid',
    'meeting.end': 'Sluttid',
    'meeting.participants': 'Deltagare',
    'meeting.settings': 'Mötesinställningar',
    'meeting.talkLink': 'Talk-länk',
    'meeting.joinInstructions': 'Anslut till mötet via Nextcloud Talk:',
    
    // Deltagarinställningar
    'participant.settings': 'Deltagarinställningar',
    'participant.email': 'E-post',
    'participant.authLevel': 'Autentiseringsnivå',
    'participant.authLevel.none': 'Ingen',
    'participant.authLevel.sms': 'SMS',
    'participant.authLevel.loa3': 'LOA-3 (BankID)',
    'participant.personalNumber': 'Personnummer',
    'participant.smsNumber': 'SMS-nummer',
    'participant.secureEmail': 'Skicka som säker e-post',
    'participant.notification': 'Notifiering',
    'participant.notification.email': 'E-post',
    'participant.notification.emailSms': 'E-post + SMS',
    
    // Knappar
    'button.save': 'Spara',
    'button.cancel': 'Avbryt',
    'button.close': 'Stäng',
    'button.ok': 'OK',
    'button.back': 'Tillbaka',
    'button.next': 'Nästa',
    
    // Meddelanden
    'message.success': 'Åtgärden lyckades',
    'message.error': 'Ett fel uppstod',
    'message.confirm': 'Är du säker?',
    'message.teamsLinkRemoved': 'Teams-länk har tagits bort',
    'message.syncedToNextcloud': 'Synkroniserat med Nextcloud Kalender',
    
    // Validering
    'validation.required': 'Detta fält är obligatoriskt',
    'validation.email': 'Ogiltig e-postadress',
    'validation.personalNumber': 'Ogiltigt personnummer (format: ÅÅÅÅMMDD-XXXX)',
    'validation.phoneNumber': 'Ogiltigt telefonnummer (format: +46XXXXXXXXX)'
  },
  
  'en-US': {
    // General
    'app.title': 'Nextcloud Talk for Outlook',
    'app.loading': 'Loading...',
    'app.error': 'An error occurred',
    
    // Authentication
    'auth.login': 'Log in',
    'auth.logout': 'Log out',
    'auth.loginRequired': 'You must log in to use this feature',
    'auth.loginButton': 'Log in with Nextcloud',
    'auth.loggingIn': 'Logging in...',
    'auth.loginSuccess': 'Login successful!',
    'auth.loginError': 'Login failed. Please try again.',
    'auth.tokenRefreshError': 'Could not refresh login. Please log in again.',
    
    // Meetings
    'meeting.create': 'Create Talk Meeting',
    'meeting.creating': 'Creating meeting...',
    'meeting.created': 'Talk meeting created!',
    'meeting.error': 'Could not create meeting',
    'meeting.title': 'Meeting title',
    'meeting.start': 'Start time',
    'meeting.end': 'End time',
    'meeting.participants': 'Participants',
    'meeting.settings': 'Meeting settings',
    'meeting.talkLink': 'Talk link',
    'meeting.joinInstructions': 'Join the meeting via Nextcloud Talk:',
    
    // Participant settings
    'participant.settings': 'Participant Settings',
    'participant.email': 'Email',
    'participant.authLevel': 'Authentication Level',
    'participant.authLevel.none': 'None',
    'participant.authLevel.sms': 'SMS',
    'participant.authLevel.loa3': 'LOA-3 (BankID)',
    'participant.personalNumber': 'Personal Number',
    'participant.smsNumber': 'SMS Number',
    'participant.secureEmail': 'Send as secure email',
    'participant.notification': 'Notification',
    'participant.notification.email': 'Email',
    'participant.notification.emailSms': 'Email + SMS',
    
    // Buttons
    'button.save': 'Save',
    'button.cancel': 'Cancel',
    'button.close': 'Close',
    'button.ok': 'OK',
    'button.back': 'Back',
    'button.next': 'Next',
    
    // Messages
    'message.success': 'Action successful',
    'message.error': 'An error occurred',
    'message.confirm': 'Are you sure?',
    'message.teamsLinkRemoved': 'Teams link has been removed',
    'message.syncedToNextcloud': 'Synced with Nextcloud Calendar',
    
    // Validation
    'validation.required': 'This field is required',
    'validation.email': 'Invalid email address',
    'validation.personalNumber': 'Invalid personal number (format: YYYYMMDD-XXXX)',
    'validation.phoneNumber': 'Invalid phone number (format: +46XXXXXXXXX)'
  }
};

class I18n {
  constructor() {
    this.currentLocale = this.detectLocale();
  }

  /**
   * Detektera användarens språk
   */
  detectLocale() {
    // Försök hämta från Office
    if (typeof Office !== 'undefined' && Office.context && Office.context.displayLanguage) {
      const officeLang = Office.context.displayLanguage;
      if (translations[officeLang]) {
        return officeLang;
      }
    }
    
    // Fallback till webbläsarens språk
    const browserLang = navigator.language || navigator.userLanguage;
    if (translations[browserLang]) {
      return browserLang;
    }
    
    // Fallback till standardspråk
    return CONFIG.DEFAULT_LOCALE;
  }

  /**
   * Sätt språk
   */
  setLocale(locale) {
    if (translations[locale]) {
      this.currentLocale = locale;
      return true;
    }
    return false;
  }

  /**
   * Hämta översättning
   */
  t(key, params = {}) {
    const translation = translations[this.currentLocale][key] || key;
    
    // Ersätt parametrar i strängen
    return translation.replace(/\{(\w+)\}/g, (match, param) => {
      return params[param] !== undefined ? params[param] : match;
    });
  }

  /**
   * Hämta alla översättningar för nuvarande språk
   */
  getAll() {
    return translations[this.currentLocale];
  }
}

// Skapa singleton-instans
const i18n = new I18n();

// Exportera
if (typeof module !== 'undefined' && module.exports) {
  module.exports = i18n;
} else {
  window.i18n = i18n;
}

