import React from 'react'
import { CSSTransition, TransitionGroup } from 'react-transition-group'

export default function AnimatedPage({children, locationKey}){
  return (
    <TransitionGroup component={null}>
      <CSSTransition key={locationKey || 'page'} classNames="fade" timeout={260} unmountOnExit>
        <div className="page">{children}</div>
      </CSSTransition>
    </TransitionGroup>
  )
}
