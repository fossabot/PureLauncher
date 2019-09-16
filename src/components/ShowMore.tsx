import './show-more.less'
import posed from 'react-pose'
import React, { useState } from 'react'

const Content = posed.div({
  closed: { height: 0 },
  open: { height: 'auto' }
})

const ShowMore: React.FC = (props) => {
  const [show, set] = useState(false)
  return <div className='show-more'>
    <div className='button' style={{
      transform: show ? 'rotate(180deg)' : undefined,
      animationIterationCount: show ? 1 : 'infinite'
    }}>
      <svg onClick={() => set(!show)} height='36' viewBox='0 0 16 16'>
        <rect x='7' y='10' width='2' height='2'/>
        <rect x='9' y='8' width='2' height='2'/>
        <rect x='5' y='8' width='2' height='2'/>
        <rect x='11' y='6' width='2' height='2'/>
        <rect x='13' y='4' width='2' height='2'/>
        <rect x='3' y='6' width='2' height='2'/>
        <rect x='1' y='4' width='2' height='2'/>
      </svg>
    </div>
    <Content pose={show ? 'open' : 'closed'} className='content'>{props.children}</Content>
  </div>
}

export default ShowMore
