import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

interface AlbumPreviewProps extends SerializableProps {
  title: string
  artist: string
  year: number
}

export const AlbumPreview = clientEntry(
  import.meta.url,
  function AlbumPreview(handle: Handle<AlbumPreviewProps>) {
    let spins = 0

    return () => (
      <button
        type="button"
        aria-label={`Preview ${handle.props.title}`}
        mix={[
          previewStyle,
          on('click', () => {
            spins++
            handle.update()
          }),
        ]}
      >
        <span mix={discStyle} style={{ transform: `rotate(${spins * 50}deg)` }}>
          <span />
        </span>
        <span mix={copyStyle}>
          <strong>{handle.props.title}</strong>
          <span>
            {handle.props.artist}, {handle.props.year}
          </span>
          <small>{spins === 0 ? 'Hydrated preview' : `Played ${spins} times`}</small>
        </span>
      </button>
    )
  },
)

const previewStyle = css({
  appearance: 'none',
  border: '1px solid #cfd7df',
  borderRadius: '8px',
  background: '#ffffff',
  color: '#1f2933',
  cursor: 'pointer',
  display: 'grid',
  gridTemplateColumns: '72px minmax(0, 1fr)',
  gap: '14px',
  padding: '14px',
  textAlign: 'left',
  width: '100%',
  transition: 'border-color 160ms ease, transform 160ms ease',
  '&:hover, &:focus-visible': {
    borderColor: '#295b70',
    outline: 'none',
    transform: 'translateY(-1px)',
  },
})

const discStyle = css({
  alignItems: 'center',
  aspectRatio: '1',
  background: 'radial-gradient(circle, #d7a84f 0 12%, #111827 13% 42%, #374151 43% 45%, #111827 46%)',
  borderRadius: '50%',
  display: 'flex',
  justifyContent: 'center',
  transition: 'transform 220ms ease',
  '& span': {
    background: '#f8fafc',
    borderRadius: '50%',
    height: '8px',
    width: '8px',
  },
})

const copyStyle = css({
  alignContent: 'center',
  display: 'grid',
  gap: '4px',
  minWidth: 0,
  '& strong': { overflowWrap: 'anywhere' },
  '& span': { color: '#52616f' },
  '& small': { color: '#1f6f54', fontWeight: 700 },
})
