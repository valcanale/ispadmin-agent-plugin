import {createRemoteJWKSet, jwtVerify} from 'jose';

export const readScope = 'ispadmin:read';

export function httpsUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || /[?#]/.test(value)) {
    throw new Error('Expected an HTTPS URL without credentials, query or fragment.');
  }
  return url;
}

export function createAuthorizer({issuer, jwksUrl, resource, allowedSubjects, keySet}) {
  httpsUrl(issuer);
  httpsUrl(resource);
  const subjects = new Set(allowedSubjects);
  if (!subjects.size) throw new Error('Configure at least one authorized OAuth subject.');
  const keys = keySet ?? createRemoteJWKSet(httpsUrl(jwksUrl));
  const authorize = async authorization => {
    const token = /^Bearer ([\w.-]+)$/i.exec(authorization ?? '')?.[1];
    if (!token) return {status: 401};
    let payload;
    try {
      ({payload} = await jwtVerify(token, keys, {
        issuer, audience: resource, requiredClaims: ['exp', 'sub'],
        algorithms: ['RS256', 'ES256'],
      }));
    } catch {
      return {status: 401};
    }
    if (!subjects.has(payload.sub)) return {status: 403};
    if (typeof payload.scope !== 'string' || !payload.scope.split(/\s+/).includes(readScope)) {
      return {status: 403, insufficientScope: true};
    }
    return {status: 200};
  };
  return Object.assign(authorize, {issuer});
}
