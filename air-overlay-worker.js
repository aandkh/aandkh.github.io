import {composeAirOverlay} from './air-overlay-integration.js?v=20261118-metro-wind';

self.onmessage = ({data}) => {
 try {self.postMessage({overlay:composeAirOverlay(data.result, data.options)});}
 catch (error) {self.postMessage({error:error.message});}
};
