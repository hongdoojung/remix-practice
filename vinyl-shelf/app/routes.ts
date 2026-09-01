import { form, get, post, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  albums: {
    index: get('/albums'),
    create: post('/albums'),
    show: get('/albums/:slug'),
    edit: form('/albums/:slug/edit'),
  },
  apiAlbums: get('/api/albums'),
})
