import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import it from './locales/it.json'

// Rileva la lingua del sistema
function getSystemLocale() {
    const systemLocale = navigator.language || navigator.userLanguage
    const localeCode = systemLocale.split('-')[0] // prendi solo la parte della lingua (es. 'it' da 'it-IT')

    // Se la lingua del sistema è supportata, usala, altrimenti usa inglese come fallback
    return ['it', 'en'].includes(localeCode) ? localeCode : 'en'
}

// Ottieni la lingua salvata o usa quella del sistema
function getInitialLocale() {
    try {
        const savedLanguage = localStorage.getItem('ui/language')
        if (savedLanguage) {
            const parsedLanguage = JSON.parse(savedLanguage)
            if (parsedLanguage === 'auto') {
                return getSystemLocale()
            }
            if (['it', 'en'].includes(parsedLanguage)) {
                return parsedLanguage
            }
        }
    } catch (e) {
        console.error('Error loading saved language:', e)
    }
    return getSystemLocale()
}

const i18n = createI18n({
    legacy: false,
    locale: getInitialLocale(),
    fallbackLocale: 'en',
    messages: {
        en,
        it
    }
})

export default i18n
