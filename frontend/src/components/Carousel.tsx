import { useState, useEffect } from 'react';
import './Carousel.css';

interface SlideData {
  id: number;
  image: string;
  title: string;
  description: string;
}

interface CarouselProps {
  slides: SlideData[];
  autoPlayInterval?: number;
}

export function Carousel({ slides, autoPlayInterval = 5000 }: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-play functionality
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [slides.length, autoPlayInterval]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
  };

  return (
    <div className="carousel-container">
      <div className="carousel-wrapper">
        <div className="carousel-slides">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className={`carousel-slide ${index === currentIndex ? 'active' : ''}`}
            >
              <img src={slide.image} alt={slide.title} className="slide-image" />
              <div className="slide-overlay">
                <div className="slide-content">
                  <h2 className="slide-title">{slide.title}</h2>
                  <p className="slide-description">{slide.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Hidden click zones for navigation */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '25%',
            height: '100%',
            cursor: 'pointer',
            zIndex: 15,
          }}
          onClick={goToPrevious}
        />
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: '25%',
            height: '100%',
            cursor: 'pointer',
            zIndex: 15,
          }}
          onClick={goToNext}
        />

        <button className="carousel-button prev" onClick={goToPrevious}>
          ‹
        </button>
        <button className="carousel-button next" onClick={goToNext}>
          ›
        </button>

        <div className="carousel-dots">
          {slides.map((_, index) => (
            <button
              key={index}
              className={`dot ${index === currentIndex ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
