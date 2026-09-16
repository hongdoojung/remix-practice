import { del, form, get, post, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  stats: get('/stats'),
  albums: {
    index: get('/albums'),
    create: post('/albums'),
    show: get('/albums/:slug'),
    recommendations: get('/albums/:slug/recommendations'),
    destroy: del('/albums/:slug'),
    edit: form('/albums/:slug/edit'),
  },
  feed: get('/feed'),
  apiAlbums: get('/api/albums'),
})
