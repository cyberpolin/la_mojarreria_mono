import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_WA_API_BASE_URL,
  timeout: 10000,
  headers: {
    'content-type': 'application/json',
    'x-api-key': import.meta.env.VITE_WA_API_KEY,
    'x-client-domain': import.meta.env.VITE_WA_CLIENT_DOMAIN,
  },
})

axios.interceptors.response.use(
  (response) => {
    console.log('API response:', response)
    if (response.status >= 200 && response.status < 300) {
      return response
    }
    console.error('API error:', response)
    return Promise.reject(new Error(`API error: ${response.statusText}`))
  },
  (error) => {
    console.error('API error:', error)
    return Promise.reject(error)
  },
)

type SubscriptionPayload = {
  name: string
  phone: string
  campaignKey: string
}

type RegistrationStatus = {
  status?: string
}

const toSubscriptionPhone = (phone: string): string => `52${phone}`

const addUser = async (phone: string, name: string) => {
  const payload: SubscriptionPayload = {
    name: name.trim(),
    phone: toSubscriptionPhone(phone),
    campaignKey: import.meta.env.VITE_WA_CAMPAIGN_KEY,
  }

  const { data } = await api.post('/messages/subscription', payload)
  return data
}

const getRegistrationStatus = async (phone: string): Promise<RegistrationStatus> => {
  const { data } = await api.get<RegistrationStatus>(
    `/messages/registrations/${encodeURIComponent(toSubscriptionPhone(phone))}/status`,
  )
  return data
}

export { addUser, getRegistrationStatus }
