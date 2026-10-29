# Three.js vendored browser distribution

- Package: `three@0.180.0`
- Source: official npm registry, `https://registry.npmjs.org/three/-/three-0.180.0.tgz`
- License: MIT, see [LICENSE](LICENSE)
- Package SHA-512 (verified before extraction):
  `o+qycAMZrh+TsE01GqWUxUIKR1AL0S8pq7zDkYOQw8GqfX8b8VoCKYUoHbhiX5j+7hr8XsuHDVU6+gkQJQKg9w==`

Only `build/three.module.min.js`, `build/three.core.min.js` and the license are retained. The files are unchanged from the package. The 3D view imports them locally, on demand; the app does not depend on a CDN. No npm installation is needed to run the app.
