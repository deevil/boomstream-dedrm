export default {
  awaiting: ()=> 'dedrm injected. Awaiting for video stream',
  processingSegment: (index, totalSegmentsCount)=> `processing segment ${ index } [${ Math.round(index / totalSegmentsCount * 100) }%]`,
  processed: ()=> 'processed!'
};