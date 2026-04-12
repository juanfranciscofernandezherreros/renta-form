/**
 * Componente de paginación reutilizable.
 * @param {{ page: number, totalPages: number, onPageChange: (p: number) => void }} props
 */
export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  const pages = []
  const delta = 2
  const left = Math.max(1, page - delta)
  const right = Math.min(totalPages, page + delta)

  for (let i = left; i <= right; i++) {
    pages.push(i)
  }

  return (
    <div className="pagination">
      <button
        className="pagination-btn"
        disabled={page === 1}
        onClick={() => onPageChange(1)}
        title="Primera página"
      >
        «
      </button>
      <button
        className="pagination-btn"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
        title="Página anterior"
      >
        ‹
      </button>

      {left > 1 && <span className="pagination-ellipsis">…</span>}

      {pages.map(p => (
        <button
          key={p}
          className={`pagination-btn${p === page ? ' active' : ''}`}
          onClick={() => onPageChange(p)}
        >
          {p}
        </button>
      ))}

      {right < totalPages && <span className="pagination-ellipsis">…</span>}

      <button
        className="pagination-btn"
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
        title="Página siguiente"
      >
        ›
      </button>
      <button
        className="pagination-btn"
        disabled={page === totalPages}
        onClick={() => onPageChange(totalPages)}
        title="Última página"
      >
        »
      </button>
    </div>
  )
}
