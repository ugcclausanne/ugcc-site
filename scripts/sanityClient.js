const {createClient} = require('@sanity/client')

const projectId = process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'y4j9iov2'
const dataset = process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
const apiVersion = process.env.SANITY_API_VERSION || '2024-10-01'
const token = process.env.SANITY_READ_TOKEN || ''

module.exports = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: !token,
  perspective: token ? 'drafts' : 'published',
})
