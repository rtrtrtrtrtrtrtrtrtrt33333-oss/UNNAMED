document.addEventListener('DOMContentLoaded', () => {
  const moodGrid = document.querySelector('.mood-grid');
  if (!moodGrid) return;

  const images = [...moodGrid.querySelectorAll('img')];
  if (!images.length) return;

  const modal = document.createElement('div');
  modal.className = 'moodboard-lightbox';
  modal.innerHTML = `
    <div class="lightbox-overlay"></div>
    <div class="lightbox-content">
      <button class="lightbox-close" type="button" aria-label="Close">&times;</button>
      <button class="lightbox-nav lightbox-prev" type="button" aria-label="Previous image">‹</button>
      <button class="lightbox-nav lightbox-next" type="button" aria-label="Next image">›</button>
      <img class="lightbox-image" src="" alt="">
    </div>
  `;
  document.body.appendChild(modal);

  const lightboxImage = modal.querySelector('.lightbox-image');
  const overlay = modal.querySelector('.lightbox-overlay');
  const closeBtn = modal.querySelector('.lightbox-close');
  const prevBtn = modal.querySelector('.lightbox-prev');
  const nextBtn = modal.querySelector('.lightbox-next');

  let currentImageIndex = 0;
  const hasMultiple = images.length > 1;

  function openLightbox(index) {
    if (index < 0 || index >= images.length) return;

    currentImageIndex = index;
    const img = images[index];
    lightboxImage.src = img.src;
    lightboxImage.alt = img.alt || '';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    prevBtn.style.display = hasMultiple ? 'flex' : 'none';
    nextBtn.style.display = hasMultiple ? 'flex' : 'none';
  }

  function closeLightbox() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function showPrevious() {
    openLightbox(currentImageIndex > 0 ? currentImageIndex - 1 : images.length - 1);
  }

  function showNext() {
    openLightbox(currentImageIndex < images.length - 1 ? currentImageIndex + 1 : 0);
  }

  images.forEach((img, index) => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', (e) => {
      e.preventDefault();
      openLightbox(index);
    });
  });

  overlay.addEventListener('click', closeLightbox);
  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); showPrevious(); });
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); showNext(); });
  lightboxImage.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('active')) return;

    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') showPrevious();
    else if (e.key === 'ArrowRight') showNext();
  });
});
