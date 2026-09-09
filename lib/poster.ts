import { groupShopItems, type ShopItem } from "@/lib/shop";
import { loadExportImage } from "@/lib/shop-images";

export type ScreenshotFields = {
  birr: boolean;
  vbucks: boolean;
  description: boolean;
};
export type ShopGroup = ReturnType<typeof groupShopItems>[number];
export type PosterOptions = {
  columns: number;
  fields: ScreenshotFields;
  birrRate: number;
  width: number;
};
export type ExportFile = { url: string; filename: string; size: number };

const POSTER_WIDTH = 1080;
const POSTER_PADDING = 8;
const SECTION_INSET = 0;

export function splitPosterGroups(
  groups: ShopGroup[],
  columns: number,
  parts: number,
): ShopGroup[][] {
  const rows: { group: ShopGroup; items: ShopItem[] }[] = [];
  for (const group of groups) {
    for (let i = 0; i < group.items.length; i += columns)
      rows.push({ group, items: group.items.slice(i, i + columns) });
  }
  const pages: ShopGroup[][] = [];
  const pageCount = Math.min(parts, rows.length);
  let cursor = 0;
  for (let part = 0; part < pageCount; part++) {
    const length = Math.ceil((rows.length - cursor) / (pageCount - part));
    const page: ShopGroup[] = [];
    for (const row of rows.slice(cursor, cursor + length)) {
      const previous = page.at(-1);
      if (previous?.category === row.group.category)
        previous.items.push(...row.items);
      else page.push({ ...row.group, items: [...row.items] });
    }
    pages.push(page);
    cursor += length;
  }
  return pages;
}

export function saveExport(file: ExportFile) {
  const link = document.createElement("a");
  link.download = file.filename;
  link.href = file.url;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getPosterLayout(
  columns: number,
  screenshotFields: ScreenshotFields,
) {
  const availableWidth = POSTER_WIDTH - POSTER_PADDING * 2 - SECTION_INSET * 2;
  const estimatedCardWidth = availableWidth / columns;
  const cardGap = clampNumber(estimatedCardWidth * 0.04, 2, 10);
  const cardWidth = (availableWidth - cardGap * (columns - 1)) / columns;
  const cardPadding = clampNumber(cardWidth * 0.045, 2, 12);
  const imageSize = cardWidth - cardPadding * 2;
  const imageInnerPadding = clampNumber(cardWidth * 0.018, 1, 7);
  const contentGap = clampNumber(cardWidth * 0.025, 1, 7);
  const metaFontSize = clampNumber(cardWidth * 0.055, 4.5, 12);
  const metaLineHeight = metaFontSize * 1.25;
  const nameFontSize = clampNumber(cardWidth * 0.092, 6, 20);
  const nameLineHeight = nameFontSize * 1.12;
  const descriptionFontSize = clampNumber(cardWidth * 0.055, 5, 12);
  const descriptionLineHeight = descriptionFontSize * 1.2;
  const priceFontSize = clampNumber(cardWidth * 0.074, 5, 15);
  const priceLineHeight = priceFontSize * 1.18;
  const pricePadding = clampNumber(cardWidth * 0.022, 1.5, 7);
  const priceLines =
    Number(screenshotFields.vbucks) + Number(screenshotFields.birr);
  let cursor = cardPadding + imageSize + contentGap;
  const metaBaseline = cursor + metaFontSize;

  cursor += metaLineHeight + contentGap * 0.65;
  const nameBaseline = cursor + nameFontSize;
  cursor += nameLineHeight * 2;

  let descriptionBaseline = 0;
  if (screenshotFields.description) {
    cursor += contentGap * 0.6;
    descriptionBaseline = cursor + descriptionFontSize;
    cursor += descriptionLineHeight;
  }

  let priceBoxY = 0;
  let priceBoxHeight = 0;
  if (priceLines > 0) {
    cursor += contentGap;
    priceBoxY = cursor;
    priceBoxHeight = pricePadding * 2 + priceLines * priceLineHeight;
    cursor += priceBoxHeight;
  }

  const cardHeight = cursor + cardPadding;
  const headerFontSize = clampNumber(cardWidth * 0.12, 10, 20);
  const countFontSize = clampNumber(cardWidth * 0.075, 7, 13);
  const sectionHeaderHeight = clampNumber(headerFontSize * 1.8, 24, 38);

  return {
    cardGap,
    cardHeight,
    cardPadding,
    cardWidth,
    contentGap,
    countFontSize,
    descriptionBaseline,
    descriptionFontSize,
    headerFontSize,
    imageInnerPadding,
    imageSize,
    metaBaseline,
    metaFontSize,
    nameBaseline,
    nameFontSize,
    nameLineHeight,
    priceBoxHeight,
    priceBoxY,
    priceFontSize,
    priceLineHeight,
    pricePadding,
    sectionFooterGap: clampNumber(cardWidth * 0.055, 4, 12),
    sectionHeaderHeight,
    sectionRadius: clampNumber(cardWidth * 0.045, 4, 10),
    interSectionGap: clampNumber(cardWidth * 0.06, 6, 14),
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let activeLine = "";

  for (const word of words) {
    const testLine = activeLine ? `${activeLine} ${word}` : word;

    if (context.measureText(testLine).width <= maxWidth || !activeLine) {
      activeLine = testLine;
      continue;
    }

    lines.push(activeLine);
    activeLine = word;

    if (lines.length === maxLines) {
      break;
    }
  }

  if (activeLine && lines.length < maxLines) {
    lines.push(activeLine);
  }

  lines.slice(0, maxLines).forEach((line, index) => {
    const renderedLine =
      index === maxLines - 1 &&
      lines.length === maxLines &&
      words.join(" ") !== lines.join(" ")
        ? `${line.replace(/\W?\w*$/, "")}...`
        : line;
    context.fillText(renderedLine, x, y + index * lineHeight, maxWidth);
  });
}

function fillReadableText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth?: number,
) {
  if (maxWidth) {
    context.fillText(text, x, y, maxWidth);
    return;
  }

  context.fillText(text, x, y);
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.min(
    width / image.naturalWidth,
    height / image.naturalHeight,
  );
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  const renderedX = x + (width - renderedWidth) / 2;
  const renderedY = y + (height - renderedHeight) / 2;

  context.drawImage(image, renderedX, renderedY, renderedWidth, renderedHeight);
}

export async function renderPoster(
  groupsToCapture: ShopGroup[],
  options: PosterOptions,
  progress: (count: number) => void,
) {
  const {
    columns: exportColumns,
    fields: screenshotFields,
    birrRate: birrPerVbuck,
    width,
  } = options;
  let completed = 0;
  const layout = getPosterLayout(exportColumns, screenshotFields);
  const posterWidth = POSTER_WIDTH;
  const posterHeight =
    POSTER_PADDING * 2 +
    groupsToCapture.reduce((height, group) => {
      const rows = Math.ceil(group.items.length / exportColumns);
      return (
        height +
        layout.sectionHeaderHeight +
        rows * layout.cardHeight +
        Math.max(rows - 1, 0) * layout.cardGap +
        layout.sectionFooterGap
      );
    }, 0) +
    Math.max(groupsToCapture.length - 1, 0) * layout.interSectionGap;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not supported in this browser.");
  }

  const logicalPosterHeight = Math.ceil(posterHeight);
  const exportScale = Math.min(
    width / POSTER_WIDTH,
    16384 / Math.max(posterWidth, logicalPosterHeight),
    Math.sqrt(24_000_000 / (posterWidth * logicalPosterHeight)),
  );
  if (posterWidth * exportScale < 720)
    throw new Error(
      "This shop is too long for one image. Choose 2 or 3 PNG files, or increase columns.",
    );

  canvas.width = Math.floor(posterWidth * exportScale);
  canvas.height = Math.floor(logicalPosterHeight * exportScale);
  try {
    context.scale(exportScale, exportScale);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    context.fillStyle = "#101214";
    context.fillRect(0, 0, posterWidth, logicalPosterHeight);

    let y = POSTER_PADDING;

    for (const group of groupsToCapture) {
      const sectionRows = Math.ceil(group.items.length / exportColumns);
      const sectionHeight =
        layout.sectionHeaderHeight +
        sectionRows * layout.cardHeight +
        Math.max(sectionRows - 1, 0) * layout.cardGap +
        layout.sectionFooterGap;

      const headerBaseline =
        y + (layout.sectionHeaderHeight + layout.headerFontSize * 0.72) / 2;
      context.fillStyle = "#67e8f9";
      context.font = `900 ${layout.headerFontSize}px Arial, sans-serif`;
      fillReadableText(
        context,
        group.label.toUpperCase(),
        POSTER_PADDING + SECTION_INSET,
        headerBaseline,
        posterWidth * 0.6,
      );
      context.fillStyle = "#e2e8f0";
      context.font = `800 ${layout.countFontSize}px Arial, sans-serif`;
      context.textAlign = "right";
      fillReadableText(
        context,
        `${group.items.length.toLocaleString()} item${group.items.length === 1 ? "" : "s"}`,
        posterWidth - POSTER_PADDING - SECTION_INSET,
        headerBaseline,
        posterWidth * 0.25,
      );
      context.textAlign = "left";

      for (
        let batchStart = 0;
        batchStart < group.items.length;
        batchStart += 4
      ) {
        const batch = group.items.slice(batchStart, batchStart + 4);
        const images = await Promise.all(batch.map(loadExportImage));
        batch.forEach((item, batchIndex) => {
          const index = batchStart + batchIndex;
          const column = index % exportColumns;
          const row = Math.floor(index / exportColumns);
          const x =
            POSTER_PADDING +
            SECTION_INSET +
            column * (layout.cardWidth + layout.cardGap);
          const cardY =
            y +
            layout.sectionHeaderHeight +
            row * (layout.cardHeight + layout.cardGap);

          roundedRect(
            context,
            x,
            cardY,
            layout.cardWidth,
            layout.cardHeight,
            clampNumber(layout.cardWidth * 0.04, 2, 8),
          );
          context.fillStyle = "#1c2024";
          context.fill();
          context.strokeStyle = "rgba(255,255,255,0.10)";
          context.stroke();

          const imageX = x + layout.cardPadding;
          const imageY = cardY + layout.cardPadding;
          roundedRect(
            context,
            imageX,
            imageY,
            layout.imageSize,
            layout.imageSize,
            clampNumber(layout.cardWidth * 0.035, 2, 7),
          );
          context.fillStyle = "#24292e";
          context.fill();

          const image = images[batchIndex];
          const artX = imageX + layout.imageInnerPadding;
          const artY = imageY + layout.imageInnerPadding;
          const artSize = layout.imageSize - layout.imageInnerPadding * 2;
          drawContainedImage(context, image, artX, artY, artSize, artSize);

          const textX = x + layout.cardPadding;
          const textWidth = layout.cardWidth - layout.cardPadding * 2;
          context.fillStyle = "#94a3b8";
          context.font = `800 ${layout.metaFontSize}px Arial, sans-serif`;
          fillReadableText(
            context,
            item.type.toUpperCase(),
            textX,
            cardY + layout.metaBaseline,
            textWidth * 0.54,
          );
          context.fillStyle = "#cffafe";
          context.textAlign = "right";
          fillReadableText(
            context,
            item.rarity.toUpperCase(),
            x + layout.cardWidth - layout.cardPadding,
            cardY + layout.metaBaseline,
            textWidth * 0.42,
          );
          context.textAlign = "left";
          context.fillStyle = "#ffffff";
          context.font = `900 ${layout.nameFontSize}px Arial, sans-serif`;
          drawText(
            context,
            item.name,
            textX,
            cardY + layout.nameBaseline,
            textWidth,
            layout.nameLineHeight,
            2,
          );

          if (screenshotFields.description) {
            context.fillStyle = "#94a3b8";
            context.font = `800 ${layout.descriptionFontSize}px Arial, sans-serif`;
            drawText(
              context,
              item.season,
              textX,
              cardY + layout.descriptionBaseline,
              textWidth,
              layout.descriptionFontSize * 1.2,
              1,
            );
          }

          if (layout.priceBoxHeight > 0) {
            roundedRect(
              context,
              textX,
              cardY + layout.priceBoxY,
              textWidth,
              layout.priceBoxHeight,
              clampNumber(layout.cardWidth * 0.02, 1, 5),
            );
            context.fillStyle = "rgba(255,255,255,0.06)";
            context.fill();
            context.font = `900 ${layout.priceFontSize}px Arial, sans-serif`;

            let priceLine = 0;
            if (screenshotFields.vbucks) {
              context.fillStyle = "#bae6fd";
              fillReadableText(
                context,
                `${item.price.toLocaleString()} V-Bucks`,
                textX + layout.pricePadding,
                cardY +
                  layout.priceBoxY +
                  layout.pricePadding +
                  layout.priceFontSize +
                  priceLine * layout.priceLineHeight,
                textWidth - layout.pricePadding * 2,
              );
              priceLine += 1;
            }

            if (screenshotFields.birr) {
              context.fillStyle = "#fde68a";
              fillReadableText(
                context,
                `${Math.round(item.price * birrPerVbuck).toLocaleString()} Birr`,
                textX + layout.pricePadding,
                cardY +
                  layout.priceBoxY +
                  layout.pricePadding +
                  layout.priceFontSize +
                  priceLine * layout.priceLineHeight,
                textWidth - layout.pricePadding * 2,
              );
            }
          }
        });
        completed += batch.length;
        progress(completed);
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }

      y += sectionHeight + layout.interSectionGap;
    }

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => {
        if (blob?.size) resolve(blob);
        else
          reject(
            new Error(
              "Your browser could not encode this image. Choose 2 or 3 PNG files.",
            ),
          );
      }, "image/png"),
    );
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}
