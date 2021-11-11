import React, { useEffect, useRef, useState } from 'react';
import * as PDFJS from 'pdfjs-dist/legacy/build/pdf';
import { Recogito } from '@recogito/recogito-js';
import { Annotorious } from '@recogito/annotorious';

import { extendTarget, splitByType } from '../PDFAnnotation';

const AnnotatablePage = props => {

  const containerEl = useRef();

  const [ pageVisible, setPageVisible ] = useState(false);

  const [ isRendered, setRendered ] = useState(false);

  const [ anno, setAnno ] = useState();

  const [ recogito, setRecogito ] = useState();

  // Renders the PDF page, returning a promise
  const renderPage = () => {
    console.log('Rendering page ' + props.page);
    
    props.pdf.getPage(props.page).then(page => {
      const scale = props.scale || 1.8;
      const viewport = page.getViewport({ scale });

      // Render the image layer to a CANVAS element
      const canvas = document.createElement('canvas');
      canvas.setAttribute('class', 'imageLayer');
      canvas.setAttribute('data-page', props.page);

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      containerEl.current.appendChild(canvas);

      const renderContext = {
        canvasContext: canvas.getContext('2d'),
        viewport
      };

      page.render(renderContext).promise.then(() => {
        page.getTextContent().then(textContent =>
          PDFJS.renderTextLayer({
            textContent: textContent,
            container: containerEl.current.querySelector('.textLayer'),
            viewport: viewport,
            textDivs: []
          }).promise.then(() => {
            setRendered(true);
          }));
      });
    });
  }

  const onCreateAnnotation = a => {
    const extended = extendTarget(a, props.url, props.page);
    props.onCreateAnnotation(extended);
  }

  const onUpdateAnnotation = (a, p) => {
    const updated = extendTarget(a, props.url, props.page);
    const previous = extendTarget(p, props.url, props.page);
    props.onUpdateAnnotation(updated, previous);
  }

  const onDeleteAnnotation = a => {
    const extended = extendTarget(a, props.url, props.page);
    props.onDeleteAnnotation(extended)
  }

  const initAnnotationLayer = () => {
    console.log('Creating annotation layer on page ' + props.page);

    const config = props.config || {};

    const { text, image } = splitByType(props.store.getAnnotations(props.page));

    const r = new Recogito({ 
      ...config,
      content: containerEl.current.querySelector('.textLayer'), 
      mode: 'pre' 
    });

    r.on('createAnnotation', onCreateAnnotation);
    r.on('updateAnnotation', onUpdateAnnotation);
    r.on('deleteAnnotation', onDeleteAnnotation);
    setRecogito(r);

    const anno = new Annotorious({
      image: containerEl.current.querySelector('.imageLayer')
    });

    anno.on('createAnnotation', onCreateAnnotation);
    anno.on('updateAnnotation', onUpdateAnnotation);
    anno.on('deleteAnnotation', onDeleteAnnotation);
    setAnno(anno);

    r.on('selectAnnotation', () => anno.selectAnnotation());
    anno.on('selectAnnotation', () => r.selectAnnotation());

    // For some reason, React is not done initializing the Image-/TextAnnotators.
    // This remains an unsolved mystery for now. The hack is to introduce a little
    // wait time until Recogito/Annotorious inits are complete.
    r.setAnnotations(text);
    anno.setAnnotations(image);    
  }

  const destroyAnnotationLayer = () => {
    if (recogito || anno)
      console.log('Destroying annotation layer on page ' + props.page);

    if (recogito)
      recogito.destroy();

    if (anno)
      anno.destroy();
  }

  // Render on page change
  useEffect(() => {
    const onIntersect = entries => {
      const intersecting = entries[0].isIntersecting;
      setPageVisible(intersecting);
    }

    // Init intersection observer
    const observer = new IntersectionObserver(onIntersect, {
      rootMargin: '40px'
    });

    const target = containerEl.current;
    observer.observe(target);

    // First page renders instantly, all others are lazy
    if (props.page === 1)
      renderPage();

    return () => 
      observer.unobserve(target);
  }, []);

  useEffect(() => {
    if (isRendered) {
      if (pageVisible) 
        initAnnotationLayer();
      else 
        destroyAnnotationLayer();
    } else if (pageVisible && props.page > 1) {
      renderPage();
    }
  }, [ isRendered, pageVisible ]);

  useEffect(() => {
    if (containerEl.current) {
      const imageLayer = containerEl.current.querySelector('svg.a9s-annotationlayer');
      
      if (imageLayer) {
        if (props.annotationMode === 'IMAGE') {
          imageLayer.style.pointerEvents = 'auto';
        } else {
          imageLayer.style.pointerEvents = null;
          recogito.setMode(props.annotationMode);
        }
      }
    }
  }, [ props.annotationMode ])

  return (
    <div
      ref={containerEl} 
      className={props.debug ? 'page-container debug' : 'page-container'}>
      <div className="textLayer" />
    </div>
  )

}

export default AnnotatablePage;