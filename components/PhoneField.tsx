'use client'

import { useEffect, useState } from 'react'
import PhoneInput, {
    isValidPhoneNumber,
    type Value as PhoneValue,
    type Country,
} from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

type PhoneFieldProps = {
    label?: string
    value: string
    onChange: (value: string) => void
    required?: boolean
    name?: string
    error?: string | null
    helperText?: string
}

// Guess country from browser language, e.g. "ka-GE", "en-US"
// Guess country from browser. Prefer time zone, then language.
function guessCountry(): Country | undefined {
    if (typeof window === 'undefined') return undefined

    // 1) Try time zone -> country
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const tzMap: Record<string, Country> = {
            'Asia/Tbilisi': 'GE',
            // add more if you ever need:
            // 'Europe/London': 'GB',
            // 'Europe/Berlin': 'DE',
            // ...
        }

        if (tz && tzMap[tz]) {
            return tzMap[tz]
        }
    } catch {
        // ignore and fall back to language
    }

    // 2) Fall back to navigator.languages / navigator.language
    const langs = navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language]

    for (const lang of langs) {
        const parts = lang.split('-')
        if (parts.length >= 2) {
            const region = parts[1]?.toUpperCase()
            if (region) return region as Country
        }
    }

    return undefined
}


export function PhoneField({
    label = 'Phone',
    value,
    onChange,
    required,
    name = 'phone',
    error,
    helperText = 'Number will be saved in international format (e.g. +995555123456).',
}: PhoneFieldProps) {
    const [defaultCountry, setDefaultCountry] = useState<Country | undefined>('GE')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        const guessed = guessCountry() // Move guessCountry inside effect to prompt re-render if needed? No, separate logic fine.
        if (guessed) setDefaultCountry(guessed)
    }, [])

    const inputId = `${name}-phone-input`
    const showError = !!error

    const handlePhoneInputChange = (val: PhoneValue) => {
        // E.164 string or undefined
        onChange(val ?? '')
    }

    const handleAutofillChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // If browser autofills this native field, push value into phone state.
        onChange(e.target.value)
    }

    return (
        <div className="flex flex-col gap-1 relative">
            <label
                className="block text-sm mb-1"
                htmlFor={inputId}
            >
                {label}
            </label>

            {mounted ? (
                <PhoneInput
                    id={inputId}
                    international
                    defaultCountry={defaultCountry}
                    value={value || undefined}
                    onChange={handlePhoneInputChange}
                    countryCallingCodeEditable={false}
                    className="phone-input w-full"
                    name={name}
                    autoComplete="tel"
                    placeholder="+995 555 12 34 56"
                />
            ) : (
                <input
                    className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500"
                    placeholder="+995 555 12 34 56"
                    disabled
                />
            )}

            {/* Hidden native input just for browser autofill / password managers */}
            <input
                type="tel"
                name={`${name}-autofill`}
                autoComplete="tel"
                value={value}
                onChange={handleAutofillChange}
                // hide visually but keep it "real" in DOM so browsers can see it
                style={{
                    position: 'absolute',
                    opacity: 0,
                    pointerEvents: 'none',
                    height: 0,
                    width: 0,
                }}
                tabIndex={-1}
                aria-hidden="true"
            />

            {showError && <p className="text-xs text-red-400">{error}</p>}
            {helperText && !showError && (
                <p className="text-[10px] text-slate-500">{helperText}</p>
            )}
        </div>
    )
}


// Helpers you can use in submit handlers
export function validatePhoneRequired(phone: string): string | null {
    if (!phone) return 'Phone is required'
    if (!isValidPhoneNumber(phone)) return 'Please enter a valid phone number'
    return null
}

export function validatePhoneOptional(phone: string): string | null {
    if (!phone) return null
    if (!isValidPhoneNumber(phone)) return 'Please enter a valid phone number'
    return null
}
