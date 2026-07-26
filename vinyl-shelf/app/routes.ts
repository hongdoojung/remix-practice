import { get, post, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  albums: get('/albums'),
  albumsAction: post('/albums'),
  album: get('/albums/:slug'),
  apiAlbums: get('/api/albums'),
})
