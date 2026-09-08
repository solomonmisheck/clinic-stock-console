import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/AsyncState';
import { useStockCatalogue } from '../hooks/useStockCatalogue';
import { useUpdateStock } from '../hooks/useUpdateStock';
import { useToast } from '../components/ui/ToastProvider';
import { StockCorrectionForm } from './item-detail/StockCorrectionForm';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import './ItemDetailPage.css';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const catalogue = useStockCatalogue();
  const updateStock = useUpdateStock();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // location.key is 'default' when this entry is the first thing loaded in the tab
  // (a pasted link, not a click from within the app) -- going back in that case would
  // leave the SPA entirely, so we send the user to the list instead.
  const cameFromWithinApp = location.key !== 'default';

  const numericId = Number(id);
  const item = catalogue.data?.find((product) => product.id === numericId);
  useDocumentTitle(item?.title ?? 'Item');

  if (catalogue.isPending) {
    return <LoadingState label="Loading item…" />;
  }

  if (catalogue.isError) {
    return (
      <ErrorState
        message={
          catalogue.error instanceof Error ? catalogue.error.message : 'Could not load this item.'
        }
        onRetry={() => catalogue.refetch()}
      />
    );
  }

  if (!item) {
    return (
      <EmptyState title="We couldn't find that item.">
        <p>It may have been removed, or the link may be incorrect.</p>
        <Link to="/stock">Back to stock list</Link>
      </EmptyState>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn btn--ghost back-link"
        onClick={() => (cameFromWithinApp ? navigate(-1) : navigate('/stock'))}
      >
        ← Back to stock list
      </button>

      <div className="item-detail">
        <img className="item-detail__image" src={item.thumbnail} alt="" />
        <div>
          <h1 className="item-detail__title">{item.title}</h1>
          <div className="item-detail__meta">
            <span>{currencyFormatter.format(item.price)}</span>
            <span style={{ textTransform: 'capitalize' }}>{item.category}</span>
            {item.brand && <span>{item.brand}</span>}
            <span>Rating {item.rating.toFixed(1)} / 5</span>
          </div>
          <p className="item-detail__description">{item.description}</p>

          <StockCorrectionForm
            currentStock={item.stock}
            onSave={async (newStock) => {
              await updateStock.mutateAsync({ id: item.id, stock: newStock });
              showToast(`Stock updated to ${newStock}.`, 'success');
            }}
          />
        </div>
      </div>
    </>
  );
}
