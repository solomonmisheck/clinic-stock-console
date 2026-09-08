import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div>
      <h1 className="page-heading">Page not found</h1>
      <p>
        <Link to="/stock">Back to the stock list</Link>
      </p>
    </div>
  );
}
