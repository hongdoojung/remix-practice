import { del, form, get, post, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  albums: {
    index: get('/albums'),
    create: post('/albums'),
    show: get('/albums/:slug'),
    destroy: del('/albums/:slug'),
    edit: form('/albums/:slug/edit'),
  },
  feed: get('/feed'),
  apiAlbums: get('/api/albums'),
})
