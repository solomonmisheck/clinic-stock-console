import { Link } from 'react-router-dom';
import type { Product } from '../../types';
import { getCorrection } from '../../lib/stock/correctionsOverlay';
import './StockListItem.css';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const LOW_STOCK_THRESHOLD = 10;

export function StockListItem({ item, to }: { item: Product; to: string }) {
  const isLow = item.stock <= LOW_STOCK_THRESHOLD;
  const wasCorrected = Boolean(getCorrection(item.id));

  return (
    <li className="stock-item">
      <Link to={to} className="stock-item__link">
        <img
          src={item.thumbnail}
          alt=""
          loading="lazy"
          width={56}
          height={56}
          className="stock-item__thumb"
        />
        <span className="stock-item__body">
          <span className="stock-item__title">{item.title}</span>
          <span className="stock-item__meta">
            <span className="stock-item__category">{item.category}</span>
            <span aria-hidden="true">·</span>
            <span>{currencyFormatter.format(item.price)}</span>
          </span>
        </span>
        <span className="stock-item__stock">
          <span
            className={isLow ? 'stock-item__count stock-item__count--low' : 'stock-item__count'}
          >
            {item.stock} in stock
          </span>
          {isLow && <span className="stock-item__badge stock-item__badge--warning">Low</span>}
          {wasCorrected && (
            <span className="stock-item__badge stock-item__badge--info">
              Corrected on this device
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
