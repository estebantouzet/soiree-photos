/* ── État global partagé entre tous les modules ─────────────── */

export const state = {
  photos:       [],
  currentFilter:'all',
  searchQuery:  '',
  sortAsc:      false,
  lightboxIdx:  null,
  gridColumns:  3,
  eventSlug:    window.EVENT_SLUG || '',
  eventConfig:  {}
};
