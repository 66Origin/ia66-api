function waitForImages(container) {
  const images = Array.from(container.querySelectorAll("img"));
  return Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    }),
  );
}

function layoutWorks() {
  const list = document.querySelector(".collection-list-works-page");
  if (!list) return;

  const items = Array.from(list.querySelectorAll(".collection-item-works"));
  if (!items.length) return;

  const width = window.innerWidth;

  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);

  let columns = 3;
  let verticalGap = 5 * rem;
  let horizontalGap = 3 * rem;
  let offsets = [30 * rem, 0, 20 * rem];

  if (width < 768 && width >= 480) {
    columns = 2;
    verticalGap = 4 * rem;
    horizontalGap = 3 * rem;
    offsets = [0, 5 * rem];
  }

  if (width < 480) {
    columns = 1;
    verticalGap = 3.5 * rem;
    horizontalGap = 0;
    offsets = [0];
  }

  const listWidth = list.clientWidth;
  const itemWidth = (listWidth - horizontalGap * (columns - 1)) / columns;

  const columnHeights = new Array(columns).fill(0);

  items.forEach((item, index) => {
    const col = index % columns;
    const left = col * (itemWidth + horizontalGap);

    if (index < columns) {
      columnHeights[col] = offsets[col] || 0;
    }

    const top = columnHeights[col];

    item.style.width = itemWidth + "px";
    item.style.left = left + "px";
    item.style.top = top + "px";

    columnHeights[col] += item.offsetHeight + verticalGap;
  });

  list.style.height = Math.max(...columnHeights) - verticalGap + "px";
}

async function initWorksLayout() {
  const list = document.querySelector(".collection-list-works-page");
  if (!list) return;

  await waitForImages(list);
  layoutWorks();

  setTimeout(layoutWorks, 150);
  setTimeout(layoutWorks, 400);
  setTimeout(layoutWorks, 800);
}

window.addEventListener("load", initWorksLayout);
window.addEventListener("resize", layoutWorks);
