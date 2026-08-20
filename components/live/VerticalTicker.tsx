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

const BUFFER_CARDS = 4;
const MAX_RENDERED_CARDS = 64;

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
  const [viewportHeight, setViewportHeight] = useState(900);
  const [cardHeight, setCardHeight] = useState(160);
  const cardStep = Math.max(1, cardHeight + settings.gap);
  const renderedCardCount = Math.min(
    MAX_RENDERED_CARDS,
    Math.max(BUFFER_CARDS + 1, Math.ceil(viewportHeight / cardStep) + BUFFER_CARDS)
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measuredCard = measureRef.current;
    if (!container || !measuredCard) {
      return;
    }

    const updateMeasurements = () => {
      setViewportHeight(Math.max(1, container.getBoundingClientRect().height));
      setCardHeight(Math.max(1, measuredCard.getBoundingClientRect().height));
    };
    const observer = new ResizeObserver(updateMeasurements);

    observer.observe(container);
    observer.observe(measuredCard);
    updateMeasurements();

    return () => observer.disconnect();
  }, [settings.cardWidth, settings.showDescription, settings.showVbucks, settings.showBirr, items.length]);

  useLayoutEffect(() => {
    const previousItems = previousItemsRef.current;
    const previousVisibleOffset = settings.direction === "down" ? 1 : 0;
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
  }, [items, settings.direction]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || items.length === 0) {
      return;
    }

    let animationFrame = 0;
    let lastTime = performance.now();
    offsetRef.current = modulo(offsetRef.current, cardStep);

    const renderTransform = () => {
      const y =
        settings.direction === "up"
          ? -offsetRef.current
          : -cardStep + offsetRef.current;
      track.style.transform = `translate3d(0, ${y.toFixed(3)}px, 0)`;
    };

    const animate = (time: number) => {
      const elapsedSeconds = Math.min(Math.max(time - lastTime, 0), 64) / 1000;
      lastTime = time;

      if (!paused) {
        offsetRef.current += settings.speed * elapsedSeconds;

        if (offsetRef.current >= cardStep) {
          const crossedCards = Math.floor(offsetRef.current / cardStep);
          offsetRef.current %= cardStep;
          const directionDelta = settings.direction === "up" ? crossedCards : -crossedCards;
          const nextStartIndex = modulo(startIndexRef.current + directionDelta, items.length);

          startIndexRef.current = nextStartIndex;
          flushSync(() => setStartIndex(nextStartIndex));
        }
      }

      renderTransform();
      animationFrame = window.requestAnimationFrame(animate);
    };

    renderTransform();
    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      track.style.transform = "";
    };
  }, [cardStep, items, paused, settings.direction, settings.speed]);

  const sequence = useMemo(
    () =>
      Array.from({ length: renderedCardCount }, (_, slot) => ({
        item: items[modulo(startIndex + slot, items.length)],
        slot
      })),
    [items, renderedCardCount, startIndex]
  );

  return (
    <div className="live-ticker" data-rendered-count={sequence.length} ref={containerRef}>
      <div
        className="live-ticker__column"
        style={{ width: `min(${settings.cardWidth}px, calc(100vw - 16px))` }}
      >
        <div
          className="live-ticker__track"
          data-testid="live-ticker-track"
          ref={trackRef}
          style={{ gap: `${settings.gap}px` }}
        >
          {sequence.map(({ item, slot }) => (
            <div key={`live-slot-${slot}`} ref={slot === 0 ? measureRef : undefined}>
              <LiveItemCard eager={slot < 4} item={item} settings={settings} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
