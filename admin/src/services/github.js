const REF = (import.meta && import.meta.env && import.meta.env.VITE_CONTENT_REF) || ''

export async function ghJSON(path, token) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`
    }
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  return res.json()
}

export async function listContentDir(owner, repo, dir, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dir}${REF ? `?ref=${encodeURIComponent(REF)}` : ''}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`
    }
  })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  return res.json()
}

export async function getJsonFile(owner, repo, path, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}${REF ? `?ref=${encodeURIComponent(REF)}` : ''}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`
    }
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  const data = await res.json()
  if (data && data.content) {
    const raw = atob(data.content.replace(/\n/g, ''))
    return JSON.parse(raw)
  }
  return null
}

export async function getFileMeta(owner, repo, path, token) {
  return ghJSON(`/repos/${owner}/${repo}/contents/${path}`, token)
}

export async function putFile(owner, repo, path, contentBase64, message, token, sha, branch) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ message, content: contentBase64, sha, branch })
  })
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`)
  return res.json()
}

export async function deleteFile(owner, repo, path, message, token, sha, branch) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ message, sha, branch })
  })
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`)
  return res.json()
}

export function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)))
}

// Repo and PR helpers for branch + PR flow
export async function getRepo(owner, repo, token) {
  return ghJSON(`/repos/${owner}/${repo}`, token)
}

export async function getBranchSha(owner, repo, branch, token) {
  const d = await ghJSON(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, token)
  return d && d.object && d.object.sha
}

export async function createBranch(owner, repo, branch, baseSha, token) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha })
  })
  if (res.status === 422) return null // exists
  if (!res.ok) throw new Error(`createBranch ${branch} failed: ${res.status}`)
  return res.json()
}

export async function createPR(owner, repo, title, head, base, body, token) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ title, head, base, body })
  })
  if (!res.ok) throw new Error(`createPR failed: ${res.status}`)
  return res.json()
}

export async function enableAutoMerge(owner, repo, prNodeId, token) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `mutation($id:ID!){ enablePullRequestAutoMerge(input:{ pullRequestId:$id, mergeMethod:SQUASH }){ pullRequest{ number } } }`,
      variables: { id: prNodeId }
    })
  })
  // If auto-merge not enabled or insufficient permissions, ignore silently
  return res.ok
}
