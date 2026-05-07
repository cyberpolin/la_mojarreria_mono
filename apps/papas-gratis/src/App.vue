<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { addUser, getRegistrationStatus } from './services/https'

const phone = ref('')
const name = ref('')
const phoneError = ref('')
const nameError = ref('')
const currentStep = ref(1)
const isStep2Loading = ref(true)
const isSubmitting = ref(false)
const submitError = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)
const phoneInputRef = ref<HTMLInputElement | null>(null)
let registrationPollingId: ReturnType<typeof window.setTimeout> | null = null
let shouldPollRegistration = false

const toDigits = (value: string): string => value.replace(/\D/g, '')

const stopRegistrationPolling = () => {
  shouldPollRegistration = false
  if (!registrationPollingId) return
  window.clearTimeout(registrationPollingId)
  registrationPollingId = null
}

const checkRegistrationStatus = async (submittedPhone: string) => {
  try {
    const registration = await getRegistrationStatus(submittedPhone)
    if (registration.status !== 'active') return

    stopRegistrationPolling()
    isStep2Loading.value = false
    isSubmitting.value = false
  } catch {
    return
  }
}

const startRegistrationPolling = (submittedPhone: string) => {
  stopRegistrationPolling()
  shouldPollRegistration = true

  const poll = async () => {
    await checkRegistrationStatus(submittedPhone)
    if (!shouldPollRegistration || !isStep2Loading.value) return
    registrationPollingId = window.setTimeout(() => {
      console.log('Polling registration status...')
      void poll()
    }, 5000)
  }
  void poll()
}

const formatPhone = (value: string): string => {
  const digits = toDigits(value)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

const validateName = (value: string): string => {
  if (/\d/.test(value)) return 'Tu nombre no puede contener números.'
  if (/[@#$%^&*()_+=[\]{};':"\\|,.<>/?]+/.test(value))
    return 'Tu nombre no puede contener caracteres especiales.'
  if (!value.trim()) return 'Queremos darte un mejor trato, nos comparte tu nombre?'
  if (value.length < 2) return 'Tu nombre es demasiado corto.'
  if (value.length > 50) return 'Tu nombre es demasiado largo.'
  return ''
}

const validatePhone = (value: string): string => {
  const digitsOnly = toDigits(value)
  if (digitsOnly.length !== 10) return 'El teléfono debe tener 10 dígitos.'
  if (!digitsOnly) return 'Ingresa tu número de teléfono.'
  return ''
}

const onPhoneInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  phone.value = formatPhone(target.value)
  submitError.value = ''
  phoneError.value = validatePhone(phone.value)
  if (phoneError.value) phoneError.value = validatePhone(phone.value)
}

const onNameInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  name.value = target.value
  submitError.value = ''
  nameError.value = validateName(name.value)
  if (phoneError.value) phoneError.value = validatePhone(phone.value)
}

const onSubmit = async () => {
  nameError.value = validateName(name.value)
  phoneError.value = validatePhone(phone.value)
  if (nameError.value || phoneError.value) return

  const submittedPhone = toDigits(phone.value)
  submitError.value = ''
  isSubmitting.value = true
  currentStep.value = 2
  isStep2Loading.value = true

  try {
    await addUser(submittedPhone, name.value)
    startRegistrationPolling(submittedPhone)
  } catch {
    stopRegistrationPolling()
    currentStep.value = 1
    isStep2Loading.value = false
    isSubmitting.value = false
    submitError.value = 'No pudimos activar tu promocion. Intentalo de nuevo en unos segundos.'
  }
}

const focusFirstErrorInput = () => {
  nameError.value = validateName(name.value)
  phoneError.value = validatePhone(phone.value)

  if (!name.value.trim() || nameError.value) {
    nameInputRef.value?.focus()
    return
  }

  if (!phone.value.trim() || phoneError.value) {
    phoneInputRef.value?.focus()
  }
}
const isSubmitDisabled = computed(() => {
  const isNameEmpty = !name.value.trim()
  const isPhoneEmpty = !phone.value.trim()
  const hasNameError = !!nameError.value
  const hasPhoneError = !!phoneError.value

  return isSubmitting.value || isNameEmpty || isPhoneEmpty || hasNameError || hasPhoneError
})

const firstErrorField = computed<'name' | 'phone' | null>(() => {
  if (!name.value.trim() || nameError.value) return 'name'
  if (!phone.value.trim() || phoneError.value) return 'phone'
  return null
})

const shouldHighlightErrors = ref(false)

onUnmounted(stopRegistrationPolling)
</script>

<template>
  <div class="h-screen flex flex-row items-center justify-center">
    <div
      class="bg-[url('/la-mojarreria-bg.jpeg')] bg-cover bg-center brightness-[.3] blur-[2px] w-full h-screen fixed -z-10"
    ></div>
    <div v-if="currentStep === 1" class="h-screen flex flex-col items-center justify-center">
      <h1 class="flex-0 text-4xl text-amber-300 text-shadow-lg/30 p-4">Gana una mojarra Gratis!</h1>
      <form
        class="flex-1 flex flex-col items-center justify-center w-full p-4"
        @submit.prevent="onSubmit"
      >
        <input
          ref="nameInputRef"
          v-model="name"
          @input="onNameInput"
          type="text"
          autocomplete="name"
          placeholder="Tu nombre"
          class="border rounded-sm p-2 w-full text-slate-50 mb-5 border-gray-500"
          :class="[
            nameError ? 'border-red-400 mb-2' : 'border-gray-500 mb-7',
            shouldHighlightErrors && firstErrorField === 'name' ? 'heartbeat' : '',
          ]"
        />
        <p v-if="nameError" class="w-full mb-5 text-sm text-red-300">{{ nameError }}</p>
        <input
          ref="phoneInputRef"
          :value="phone"
          @input="onPhoneInput"
          type="tel"
          maxlength="14"
          inputmode="numeric"
          autocomplete="tel"
          placeholder="(993) 312-3456"
          class="border rounded-sm p-2 w-full text-slate-50"
          :class="[
            phoneError ? 'border-red-400 mb-2' : 'border-gray-500 mb-7',
            shouldHighlightErrors && firstErrorField === 'phone' ? 'heartbeat' : '',
          ]"
        />
        <p v-if="phoneError" class="w-full mb-5 text-sm text-red-300">{{ phoneError }}</p>
        <p v-if="submitError" class="w-full mb-5 text-sm text-red-300">{{ submitError }}</p>
        <div
          class="relative w-full group"
          :tabindex="isSubmitDisabled ? 0 : -1"
          @mouseenter="shouldHighlightErrors = isSubmitDisabled"
          @mouseleave="shouldHighlightErrors = false"
          @focusin="shouldHighlightErrors = isSubmitDisabled"
          @focusout="shouldHighlightErrors = false"
          @click="isSubmitDisabled && focusFirstErrorInput()"
          @keydown.enter.prevent="isSubmitDisabled && focusFirstErrorInput()"
          @keydown.space.prevent="isSubmitDisabled && focusFirstErrorInput()"
        >
          <button
            type="submit"
            :disabled="isSubmitDisabled"
            :class="[
              'bg-linear-to-b from-green-500 to-green-700 text-slate-50 px-4 py-2 rounded-sm w-full inline-flex items-center justify-center gap-2',
              isSubmitDisabled
                ? 'opacity-20 cursor-not-allowed pointer-events-none'
                : 'hover:from-green-600 hover:to-green-800',
            ]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="h-5 w-5"
              aria-hidden="true"
            >
              <path
                d="M20.52 3.48A11.88 11.88 0 0 0 12.06 0C5.45 0 .06 5.4.06 12.02c0 2.12.55 4.2 1.6 6.03L0 24l6.1-1.6a11.96 11.96 0 0 0 5.95 1.53h.01c6.62 0 12.02-5.39 12.02-12.01 0-3.21-1.25-6.23-3.56-8.44Zm-8.46 18.43h-.01a9.93 9.93 0 0 1-5.06-1.39l-.36-.21-3.62.95.97-3.53-.23-.37A9.94 9.94 0 0 1 2.08 12C2.08 6.5 6.55 2.03 12.05 2.03c2.66 0 5.16 1.04 7.03 2.92A9.86 9.86 0 0 1 22 12c0 5.5-4.47 9.91-9.94 9.91Zm5.45-7.44c-.3-.15-1.77-.88-2.05-.98-.27-.1-.47-.15-.67.15-.2.3-.77.98-.94 1.18-.17.2-.35.23-.65.08-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.68-2.08-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.23-.24-.58-.48-.5-.67-.5h-.57c-.2 0-.52.08-.8.37-.27.3-1.05 1.02-1.05 2.48 0 1.46 1.08 2.88 1.23 3.08.15.2 2.12 3.24 5.13 4.54.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.08-.13-.27-.2-.57-.35Z"
              />
            </svg>
            <span>{{ isSubmitting ? 'Activando...' : 'Activa tu promoción' }}</span>
          </button>
          <div
            v-if="isSubmitDisabled"
            class="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden -translate-x-1/2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 shadow-lg group-hover:block group-focus:block"
          >
            Aun hay errores en el formulario, o esta vacio. Por favor corrige los errores para
            continuar.
          </div>
        </div>
        <div class="p-10 text-sm">
          <span class="text-gray-400"
            >Te enviaremos un mensaje para confirmar tu participación.</span
          >
          <span class="text-gray-400">No usaremos tu información personal para otros fines...</span>
        </div>
      </form>

      <span class="flex flex-0 p-4 text-gray-400">Paso 1 de 2</span>
    </div>

    <div v-if="currentStep === 2" class="h-screen flex flex-col items-center justify-center">
      <div v-if="isStep2Loading" class="flex flex-col items-center gap-4">
        <div
          class="h-10 w-10 rounded-full border-4 border-slate-600 border-t-amber-300 animate-spin"
        ></div>
        <p class="text-slate-300 text-sm">Procesando tu participación...</p>
        <p class="text-slate-300 text-sm">
          Recebiras un Whatsapp desde nuestro numero, solo contestalo y se activara tu promocion...
        </p>
      </div>
      <template v-else>
        <h1 class="text-4xl text-amber-300 text-shadow-lg/30 p-4">¡Hemos activado tu promoción!</h1>
        <p class="text-gray-400 p-4">
          Ya no tienes que hacer nada, en tu proximo pedido, solo pregunta por tu promoción activa.
        </p>
        <p class="text-gray-400 p-4">
          Esperamos servirte pronto y mandarte tus ricas papas gratis.
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.heartbeat {
  animation: heartbeat 1.1s ease-in-out infinite;
}

@keyframes heartbeat {
  0% {
    transform: scale(1);
  }
  14% {
    transform: scale(1.03);
  }
  28% {
    transform: scale(1);
  }
  42% {
    transform: scale(1.03);
  }
  70% {
    transform: scale(1);
  }
}
</style>
