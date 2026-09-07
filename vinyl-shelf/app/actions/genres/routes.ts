import { get, route } from 'remix/routes'

// 상대 pattern만 안다. 어느 URL 아래 놓일지는 app/routes.ts가 route('/genres', genreRoutes)로 정한다.
export const genreRoutes = route({
  index: get('/'),
  show: get('/:genre'),
})
