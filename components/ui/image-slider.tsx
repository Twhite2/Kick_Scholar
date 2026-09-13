"use client"

import * as React from "react"
import Image, { type StaticImageData } from "next/image"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

export function ImageSlider({
  images,
  interval = 5000,
  className,
}: {
  images: (StaticImageData | string)[]
  interval?: number
  className?: string
}) {
  const [index, setIndex] = React.useState(0)
  const reduceMotion = useReducedMotion()

  React.useEffect(() => {
    if (images.length <= 1 || reduceMotion) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length)
    }, interval)
    return () => clearInterval(id)
  }, [images.length, interval, reduceMotion])

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-muted", className)}>
      <AnimatePresence initial={false}>
        <motion.div
          key={index}
          className="absolute inset-0"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
        >
          <Image
            src={images[index]}
            alt=""
            fill
            priority={index === 0}
            sizes="(min-width: 1024px) 40vw, 0px"
            className="object-cover"
          />
        </motion.div>
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />

      {images.length > 1 && (
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show image ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/75",
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
