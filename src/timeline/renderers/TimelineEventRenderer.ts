import { EventRenderer, htmlEscape, cssToStr, applyStyle, computeHeightAndMargins } from 'fullcalendar'
import ScrollFollowerSprite from '../../util/ScrollFollowerSprite'
import TimelineView from '../TimelineView'


export default class TimelineEventRenderer extends EventRenderer {

  component: TimelineView


  computeDisplayEventTime() {
    return !this.view.isTimeScale // because times should be obvious via axis
  }


  computeDisplayEventEnd() {
    return false
  }


  // Computes a default event time formatting string if `timeFormat` is not explicitly defined
  computeEventTimeFormat() {
    return this.view.opt('extraSmallTimeFormat')
  }


  renderFgSegs(segs) {
    const { eventTitleFollower } = this.view

    for (let seg of segs) {
      // TODO: centralize logic (also in updateSegPositions)
      const coords = this.component.rangeToCoords(seg)
      applyStyle(seg.el, {
        left: (seg.left = coords.left),
        right: -(seg.right = coords.right)
      })
    }

    // attach segs
    for (let seg of segs) {
      this.component.segContainerEl.appendChild(seg.el)
    }

    // compute seg verticals
    for (let seg of segs) {
      seg.height = computeHeightAndMargins(seg.el)
    }

    this.buildSegLevels(segs)
    this.component.segContainerHeight = computeOffsetForSegs(segs) // returns this value!

    // assign seg verticals
    for (let seg of segs) {
      applyStyle(seg.el, 'top', seg.top)
    }

    this.component.segContainerEl.style.height = this.component.segContainerHeight + 'px'

    for (let seg of segs) {
      const titleEl = seg.el.querySelector('.fc-title')

      if (titleEl) {
        seg.scrollFollowerSprite = new ScrollFollowerSprite(titleEl)
        eventTitleFollower.addSprite(seg.scrollFollowerSprite)
      }
    }
  }


  // NOTE: this modifies the order of segs
  buildSegLevels(segs) {
    const segLevels = []

    this.sortEventSegs(segs)

    for (let unplacedSeg of segs) {
      unplacedSeg.above = []

      // determine the first level with no collisions
      let level = 0 // level index
      while (level < segLevels.length) {
        let isLevelCollision = false

        // determine collisions
        for (let placedSeg of segLevels[level]) {
          if (timeRowSegsCollide(unplacedSeg, placedSeg)) {
            unplacedSeg.above.push(placedSeg)
            isLevelCollision = true
          }
        }

        if (isLevelCollision) {
          level += 1
        } else {
          break
        }
      }

      // insert into the first non-colliding level. create if necessary
      (segLevels[level] || (segLevels[level] = []))
        .push(unplacedSeg)

      // record possible colliding segments below (TODO: automated test for this)
      level += 1
      while (level < segLevels.length) {
        for (let belowSeg of segLevels[level]) {
          if (timeRowSegsCollide(unplacedSeg, belowSeg)) {
            belowSeg.above.push(unplacedSeg)
          }
        }
        level += 1
      }
    }

    return segLevels
  }


  unrenderFgSegs(segs) {
    if (this.component.segContainerEl) { // rendered before?
      const { eventTitleFollower } = this.view

      for (let seg of segs) {
        if (seg.scrollFollowerSprite) {
          eventTitleFollower.removeSprite(seg.scrollFollowerSprite)
        }
      }

      this.component.segContainerEl.innerHTML = ''
      this.component.segContainerEl.style.height = ''
      this.component.segContainerHeight = null
    }
  }


  fgSegHtml(seg, disableResizing) {
    const { eventDef } = seg.footprint
    const isDraggable = this.view.isEventDefDraggable(eventDef)
    const isResizableFromStart = seg.isStart && this.view.isEventDefResizableFromStart(eventDef)
    const isResizableFromEnd = seg.isEnd && this.view.isEventDefResizableFromEnd(eventDef)

    const classes = this.getSegClasses(seg, isDraggable, isResizableFromStart || isResizableFromEnd)
    classes.unshift('fc-timeline-event', 'fc-h-event')

    const timeText = this.getTimeText(seg.footprint)

    return '<a class="' + classes.join(' ') + '" style="' + cssToStr(this.getSkinCss(seg.footprint.eventDef)) + '"' +
      (eventDef.url ?
        ' href="' + htmlEscape(eventDef.url) + '"' :
        '') +
      '>' +
      '<div class="fc-content">' +
        (timeText ?
          '<span class="fc-time">' +
            htmlEscape(timeText) +
          '</span>'
        :
          '') +
        '<span class="fc-title">' +
          (eventDef.title ? htmlEscape(eventDef.title) : '&nbsp;') +
        '</span>' +
      '</div>' +
      '<div class="fc-bg"></div>' +
      (isResizableFromStart ?
        '<div class="fc-resizer fc-start-resizer"></div>' :
        '') +
      (isResizableFromEnd ?
        '<div class="fc-resizer fc-end-resizer"></div>' :
        '') +
    '</a>'
  }

}


// Seg Rendering Utils
// ----------------------------------------------------------------------------------------------------------------------


function computeOffsetForSegs(segs) {
  let max = 0

  for (let seg of segs) {
    max = Math.max(max, computeOffsetForSeg(seg))
  }

  return max
}


function computeOffsetForSeg(seg) {
  if ((seg.top == null)) {
    seg.top = computeOffsetForSegs(seg.above)
  }

  return seg.top + seg.height
}


function timeRowSegsCollide (seg0, seg1) {
  return (seg0.left < seg1.right) && (seg0.right > seg1.left)
}
