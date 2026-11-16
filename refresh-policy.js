// Retrieval cadence belongs to the runtime, not the provider's verification date.
// Manual refreshes and viewport/filter requests are independent of this timer.
export function shouldRefreshLayer({now=Date.now(),lastCompletedAt,period,status,inFlight=false,hidden=false}={}){
 if(hidden||inFlight||!Number.isFinite(now)||!Number.isFinite(period)||period<=0)return false;
 if(!Number.isFinite(lastCompletedAt))return true;
 const elapsed=now-lastCompletedAt;
 const cadence=status==='unavailable'?Math.min(period,60000):period;
 return elapsed<0||elapsed>=cadence;
}
