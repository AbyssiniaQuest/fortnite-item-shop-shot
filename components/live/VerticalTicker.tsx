"use client";

import { flushSync } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LiveItemCard } from "@/components/live/LiveItemCard";
import type { LiveOverlaySettings } from "@/lib/live-overlay";
import type { ShopItem } from "@/lib/shop";

type VerticalTickerProps = {
  items: ShopItem[];
  settings: LiveOverlaySettings;
  paused?: boolean;
};

const BUFFER_CARDS = 2;
const MAX_RENDERED_CARDS = 48;

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

export function VerticalTicker({ items, settings, paused = false }: VerticalTickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const startIndexRef = useRef(0);
  const offsetRef = useRef(0);
  const previousItemsRef = useRef(items);
  const [startIndex, setStartIndex] = useState(0);
  const [viewportExtent, setViewportExtent] = useState(900);
  const [cardExtent, setCardExtent] = useState(160);
  const isHorizontal = settings.orientation === "horizontal";
  const isReverse = settings.direction === "down" || settings.direction === "right";
  const cardStep = Math.max(1, cardExtent + settings.gap);
  const sequenceExtent =
    items.length * cardExtent + Math.max(0, items.length - 1) * settings.gap;
  const isStatic = items.length <= 1 || sequenceExtent <= viewportExtent;
  const renderedCardCount = isStatic
    ? items.length
    : Math.min(
        MAX_RENDERED_CARDS,
        items.length + 1,
        Math.max(BUFFER_CARDS + 1, Math.ceil(viewportExtent / cardStep) + BUFFER_CARDS)
      );

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measuredCard = measureRef.current;
    if (!container || !measuredCard) {
      return;
    }

    const updateMeasurements = () => {
      const containerRect = container.getBoundingClientRect();
      const cardRect = measuredCard.getBoundingClientRect();
      const nextCardExtent = isHorizontal ? cardRect.width : cardRect.height;
      setViewportExtent(Math.max(1, isHorizontal ? containerRect.width : containerRect.height));

      if (nextCardExtent > 1) {
        setCardExtent(nextCardExtent);
      }
    };
    const observer = new ResizeObserver(updateMeasurements);

    observer.observe(container);
    observer.observe(measuredCard);
    updateMeasurements();

    return () => observer.disconnect();
  }, [
    isHorizontal,
    startIndex,
    settings.cardWidth,
    settings.showImage,
    settings.showName,
    settings.showMeta,
    settings.showDescription,
    settings.showVbucks,
    settings.showBirr,
    settings.birrTextSize,
    items.length
  ]);

  useLayoutEffect(() => {
    const previousItems = previousItemsRef.current;
    const previousVisibleOffset = isReverse ? 1 : 0;
    const previousVisibleItem =
      previousItems.length > 0
        ? previousItems[modulo(startIndexRef.current + previousVisibleOffset, previousItems.length)]
        : undefined;
    const retainedIndex = previousVisibleItem
      ? items.findIndex((item) => item.id === previousVisibleItem.id)
      : -1;
    const nextStartIndex =
      items.length === 0
        ? 0
        : retainedIndex >= 0
          ? modulo(retainedIndex - previousVisibleOffset, items.length)
          : modulo(startIndexRef.current, items.length);

    previousItemsRef.current = items;
    startIndexRef.current = nextStartIndex;
    setStartIndex(nextStartIndex);
  }, [isReverse, items]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || items.length === 0) {
      return;
    }

    if (isStatic) {
      offsetRef.current = 0;
      track.style.transform = "translate3d(0, 0, 0)";
      return () => {
        track.style.transform = "";
      };
    }

    let animationFrame = 0;
    let lastTime = performance.now();
    offsetRef.current = modulo(offsetRef.current, cardStep);

    const renderTransform = () => {
      const position = isReverse ? -cardStep + offsetRef.current : -offsetRef.current;
      const x = isHorizontal ? position : 0;
      const y = isHorizontal ? 0 : position;
      track.style.transform = `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0)`;
    };

    const animate = (time: number) => {
      const elapsedSeconds = Math.min(Math.max(time - lastTime, 0), 64) / 1000;
      lastTime = time;

      if (!paused) {
        offsetRef.current += settings.speed * elapsedSeconds;

        if (offsetRef.current >= cardStep) {
          const crossedCards = Math.floor(offsetRef.current / cardStep);
          offsetRef.current %= cardStep;
          const directionDelta = isReverse ? -crossedCards : crossedCards;
          const nextStartIndex = modulo(startIndexRef.current + directionDelta, items.length);

          startIndexRef.current = nextStartIndex;
          flushSync(() => setStartIndex(nextStartIndex));
        }
      }

      renderTransform();
      animationFrame = window.requestAnimationFrame(animate);
    };

    renderTransform();
    if (paused) {
      return () => {
        track.style.transform = "";
      };
    }
    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      track.style.transform = "";
    };
  }, [cardStep, isHorizontal, isReverse, isStatic, items, paused, settings.speed]);

  const sequence = useMemo(
    () => {
      const sequenceStart = isStatic ? 0 : startIndex;
      const occurrences = new Map<string, number>();

      return Array.from({ length: renderedCardCount }, (_, slot) => {
        const item = items[modulo(sequenceStart + slot, items.length)];
        const occurrence = occurrences.get(item.id) ?? 0;
        occurrences.set(item.id, occurrence + 1);

        return {
          item,
          key: occurrence === 0 ? item.id : `${item.id}--${occurrence}`,
          slot
        };
      });
    },
    [isStatic, items, renderedCardCount, startIndex]
  );

  return (
    <div
      className="live-ticker"
      data-rendered-count={sequence.length}
      data-start-index={isStatic ? 0 : startIndex}
      data-static={isStatic ? "true" : "false"}
      ref={containerRef}
    >
      <div
        className={`live-ticker__lane ${isHorizontal ? "live-ticker__lane--horizontal" : "live-ticker__lane--vertical"}`}
        style={
          isHorizontal
            ? undefined
            : { width: `min(${settings.cardWidth}px, calc(100vw - 16px))` }
        }
      >
        <div
          className={`live-ticker__track ${isHorizontal ? "live-ticker__track--horizontal" : ""}`}
          data-testid="live-ticker-track"
          ref={trackRef}
          style={{ gap: `${settings.gap}px` }}
        >
          {sequence.map(({ item, key, slot }) => (
            <div
              className="live-ticker__slot"
              key={key}
              ref={slot === 0 ? measureRef : undefined}
              style={
                isHorizontal
                  ? { width: `min(${settings.cardWidth}px, calc(100vw - 16px))` }
                  : undefined
              }
            >
              <LiveItemCard item={item} settings={settings} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
