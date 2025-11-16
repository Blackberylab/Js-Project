const DATA_URL = './data/data.json';
const PAGE_SIZE = 6;
const heroSlides = document.querySelectorAll('.hero__slide');
const heroPrev = document.querySelector('.hero__control--prev');
const heroNext = document.querySelector('.hero__control--next');
const notice = document.getElementById('notice');
const highlightsList = document.querySelector('.studio__highlights');
const statTotal = document.getElementById('stat-total');
const statOpen = document.getElementById('stat-open');
const statEvents = document.getElementById('stat-events');
const scheduleList = document.getElementById('scheduleList');
const styleFilter = document.getElementById('styleFilter');
const levelFilter = document.getElementById('levelFilter');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageIndicator = document.getElementById('pageIndicator');
const eventsList = document.querySelector('.events__list');
const galleryGrid = document.querySelector('.gallery__grid');
const calendarGrid = document.querySelector('.calendar__grid');
const calendarLabel = document.getElementById('calendarLabel');
const calendarDetails = document.querySelector('.calendar__details');
const calendarPrev = document.getElementById('calendarPrev');
const calendarNext = document.getElementById('calendarNext');
const yearEl = document.getElementById('year');

yearEl.textContent = new Date().getFullYear();

const template = {
  classCard: document.getElementById('classCardTemplate'),
  eventCard: document.getElementById('eventTemplate'),
};

const state = {
  classes: [],
  events: [],
  gallery: [],
  filtered: [],
  page: 1,
  calendarDate: new Date(),
  enrollments: new Set(JSON.parse(localStorage.getItem('pm-enrollments') || '[]')),
  eventReservations: new Set(JSON.parse(localStorage.getItem('pm-events') || '[]')),
};

function showNotice(message, type = 'info') {
  notice.textContent = message;
  notice.dataset.type = type;
  notice.hidden = false;
  setTimeout(() => {
    notice.hidden = true;
  }, 4000);
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error('Unable to load studio data');
    const data = await response.json();
    state.classes = data.classes;
    state.events = data.events;
    state.gallery = data.gallery;
    renderHighlights(data.studioInfo);
    populateStyleFilter();
    updateStats();
    applyFilters();
    renderEvents();
    renderGallery();
    renderCalendar();
  } catch (error) {
    console.error(error);
    showNotice(error.message, 'error');
  }
}

function renderHighlights(info) {
  if (!info) return;
  document.querySelector('.studio__info h1').textContent = info.name;
  document.querySelector('.studio__lead').textContent = info.description;
  highlightsList.innerHTML = '';
  info.highlights.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    highlightsList.appendChild(li);
  });
}

function updateStats() {
  statTotal.textContent = state.classes.length;
  const openSeats = state.classes.reduce((sum, cls) => {
    const reserved = state.enrollments.has(cls.id) ? 1 : 0;
    return sum + Math.max(cls.spots - (cls.enrolled + reserved), 0);
  }, 0);
  statOpen.textContent = openSeats;
  statEvents.textContent = state.events.length;
}

function populateStyleFilter() {
  const styles = Array.from(new Set(state.classes.map((cls) => cls.style)));
  styles.sort().forEach((style) => {
    const option = document.createElement('option');
    option.value = style;
    option.textContent = style;
    styleFilter.appendChild(option);
  });
}

function applyFilters() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const styleValue = styleFilter.value;
  const levelValue = levelFilter.value;
  const sorted = [...state.classes].filter((cls) => {
    const matchesSearch = cls.title.toLowerCase().includes(searchTerm);
    const matchesStyle = styleValue === 'all' || cls.style === styleValue;
    const matchesLevel = levelValue === 'all' || cls.level === levelValue;
    return matchesSearch && matchesStyle && matchesLevel;
  });

  sorted.sort((a, b) => {
    if (sortSelect.value === 'spots') return b.spots - a.spots;
    if (sortSelect.value === 'title') return a.title.localeCompare(b.title);
    return new Date(a.date) - new Date(b.date);
  });

  state.filtered = sorted;
  state.page = 1;
  renderClasses();
}

function paginate(list) {
  const start = (state.page - 1) * PAGE_SIZE;
  return list.slice(start, start + PAGE_SIZE);
}

function renderClasses() {
  scheduleList.innerHTML = '';
  const items = paginate(state.filtered);
  if (!items.length) {
    scheduleList.innerHTML = '<p>No classes match your filters.</p>';
    pageIndicator.textContent = '0 / 0';
    return;
  }
  items.forEach((cls) => {
    const card = template.classCard.content.cloneNode(true);
    const img = card.querySelector('img');
    img.src = cls.cover;
    img.alt = `${cls.title} cover image`;
    card.querySelector('h3').textContent = cls.title;
    card.querySelector('.class-card__meta').textContent = `${cls.style} · ${cls.level} · ${formatDate(cls.date)}`;
    card.querySelector('.class-card__location').textContent = `${cls.location} · ${cls.duration} min`;
    const seatsLeft = Math.max(cls.spots - cls.enrolled - (state.enrollments.has(cls.id) ? 1 : 0), 0);
    card.querySelector('.class-card__seats').textContent = `${cls.enrolled} enrolled · ${seatsLeft} seats left`;
    const btn = card.querySelector('button');
    btn.dataset.id = cls.id;
    btn.disabled = seatsLeft === 0 || state.enrollments.has(cls.id);
    btn.textContent = state.enrollments.has(cls.id) ? 'Enrolled' : 'Enroll';
    btn.addEventListener('click', handleEnroll);
    scheduleList.appendChild(card);
  });
  const totalPages = Math.ceil(state.filtered.length / PAGE_SIZE) || 1;
  pageIndicator.textContent = `${state.page} / ${totalPages}`;
  prevPageBtn.disabled = state.page === 1;
  nextPageBtn.disabled = state.page === totalPages;
}

function handleEnroll(event) {
  const id = event.currentTarget.dataset.id;
  state.enrollments.add(id);
  localStorage.setItem('pm-enrollments', JSON.stringify(Array.from(state.enrollments)));
  showNotice('Seat reserved! View it in your calendar.', 'success');
  updateStats();
  renderClasses();
  renderCalendar();
}

function renderEvents() {
  eventsList.innerHTML = '';
  state.events.forEach((evt) => {
    const card = template.eventCard.content.cloneNode(true);
    card.querySelector('h3').textContent = evt.title;
    card.querySelector('.event-card__date').textContent = formatDate(evt.date, { withTime: true });
    card.querySelector('.event-card__description').textContent = evt.description;
    const remaining = Math.max(evt.spots - evt.enrolled - (state.eventReservations.has(evt.id) ? 1 : 0), 0);
    card.querySelector('.event-card__seats').textContent = `${remaining} of ${evt.spots} seats open · ${evt.location}`;
    const btn = card.querySelector('button');
    btn.dataset.id = evt.id;
    btn.disabled = remaining === 0 || state.eventReservations.has(evt.id);
    btn.textContent = state.eventReservations.has(evt.id) ? 'Reserved' : 'Reserve';
    btn.addEventListener('click', handleEventReserve);
    eventsList.appendChild(card);
  });
}

function handleEventReserve(event) {
  const id = event.currentTarget.dataset.id;
  state.eventReservations.add(id);
  localStorage.setItem('pm-events', JSON.stringify(Array.from(state.eventReservations)));
  showNotice('Event reservation confirmed!', 'success');
  renderEvents();
}

function renderGallery() {
  galleryGrid.innerHTML = '';
  state.gallery.forEach((src) => {
    const figure = document.createElement('figure');
    figure.className = 'gallery__item';
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Dance studio gallery photo';
    figure.appendChild(img);
    galleryGrid.appendChild(figure);
  });
}

function renderCalendar() {
  const month = state.calendarDate.getMonth();
  const year = state.calendarDate.getFullYear();
  calendarLabel.textContent = state.calendarDate.toLocaleDateString('en', { month: 'long', year: 'numeric' });
  calendarGrid.innerHTML = '';
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const enrolledClasses = state.classes.filter((cls) => state.enrollments.has(cls.id));

  for (let i = 0; i < startDay; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'calendar__cell calendar__cell--empty';
    calendarGrid.appendChild(cell);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cellDate = new Date(year, month, day);
    const isoDate = cellDate.toISOString().slice(0, 10);
    const items = enrolledClasses.filter((cls) => cls.date.startsWith(isoDate));
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'calendar__cell';
    cell.innerHTML = `<span>${day}</span>`;
    if (items.length) {
      cell.classList.add('calendar__cell--has-event');
      cell.dataset.count = items.length;
    }
    cell.addEventListener('click', () => showCalendarDetails(cellDate, items));
    calendarGrid.appendChild(cell);
  }

  calendarDetails.textContent = enrolledClasses.length
    ? 'Select a highlighted date to view details.'
    : 'Your calendar is empty. Reserve a class to get started!';
}

function showCalendarDetails(date, classesForDay) {
  if (!classesForDay.length) {
    calendarDetails.textContent = `${date.toDateString()}: no reservations yet.`;
    return;
  }
  const items = classesForDay
    .map((cls) => `${cls.title} · ${formatTime(cls.date)} · ${cls.location}`)
    .join('\n');
  calendarDetails.textContent = `${date.toDateString()}\n${items}`;
}

function formatDate(dateString, options = {}) {
  const date = new Date(dateString);
  const datePart = date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
  return options.withTime ? `${datePart} · ${formatTime(dateString)}` : datePart;
}

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
}

function handlePageChange(delta) {
  const totalPages = Math.ceil(state.filtered.length / PAGE_SIZE) || 1;
  state.page = Math.min(Math.max(1, state.page + delta), totalPages);
  renderClasses();
}

function initSlider() {
  let index = 0;
  const total = heroSlides.length;
  function showSlide(newIndex) {
    index = (newIndex + total) % total;
    heroSlides.forEach((slide, idx) => {
      slide.classList.toggle('hero__slide--active', idx === index);
    });
  }
  heroPrev.addEventListener('click', () => showSlide(index - 1));
  heroNext.addEventListener('click', () => showSlide(index + 1));
  setInterval(() => showSlide(index + 1), 6000);
  showSlide(0);
}

searchInput.addEventListener('input', applyFilters);
styleFilter.addEventListener('change', applyFilters);
levelFilter.addEventListener('change', applyFilters);
sortSelect.addEventListener('change', applyFilters);
prevPageBtn.addEventListener('click', () => handlePageChange(-1));
nextPageBtn.addEventListener('click', () => handlePageChange(1));
calendarPrev.addEventListener('click', () => {
  state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
  renderCalendar();
});
calendarNext.addEventListener('click', () => {
  state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
  renderCalendar();
});

document.querySelector('.contact__form').addEventListener('submit', (event) => {
  event.preventDefault();
  event.target.reset();
  showNotice('Message sent. We will reply within one business day.', 'success');
});

initSlider();
loadData();
