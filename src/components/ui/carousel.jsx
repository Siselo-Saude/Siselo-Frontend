import * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

const CarouselContext = React.createContext(null);

function Carousel({ className, children, ...props }) {
  const viewportRef = React.useRef(null);
  const scrollBy = React.useCallback((direction) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({ left: direction * viewport.clientWidth * 0.85, behavior: "smooth" });
  }, []);

  return (
    <CarouselContext.Provider value={{ viewportRef, scrollBy }}>
      <div className={cn("relative", className)} role="region" aria-roledescription="carousel" {...props}>
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

function CarouselContent({ className, ...props }) {
  const context = React.useContext(CarouselContext);
  return <div ref={context?.viewportRef} className={cn("flex snap-x snap-mandatory overflow-x-auto scroll-smooth", className)} {...props} />;
}

function CarouselItem({ className, ...props }) {
  return <div role="group" aria-roledescription="slide" className={cn("min-w-0 shrink-0 grow-0 basis-full snap-start pl-4", className)} {...props} />;
}

function CarouselPrevious({ className, ...props }) {
  const context = React.useContext(CarouselContext);
  return <Button type="button" variant="outline" size="icon" className={cn("absolute left-2 top-1/2 -translate-y-1/2", className)} onClick={() => context?.scrollBy(-1)} {...props}>‹</Button>;
}

function CarouselNext({ className, ...props }) {
  const context = React.useContext(CarouselContext);
  return <Button type="button" variant="outline" size="icon" className={cn("absolute right-2 top-1/2 -translate-y-1/2", className)} onClick={() => context?.scrollBy(1)} {...props}>›</Button>;
}

export { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext };
