import './ui/retired.css';
import type {} from '../public/dashhq/dashhq-shell';

const params = new URLSearchParams(location.search);
const network = params.get('network') ?? 'mainnet';
document.querySelector('dashhq-bar')?.setAttribute('network', network);
const destination = window.dashhq.href('explorer', '/tools/fees/?' + params.toString());
const link = document.querySelector<HTMLAnchorElement>('#fee-destination')!;
link.href = destination;
window.setTimeout(() => location.replace(destination), 4500);
