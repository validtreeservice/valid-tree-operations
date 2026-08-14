import PageHeader from '../components/PageHeader'

export default function PlaceholderPage({ title, description }) {
  return (
    <section>
      <PageHeader title={title} description={description} />
      <article className="panel empty-state">
        <p className="eyebrow">NEXT BUILD PHASE</p>
        <h2>{title} module is ready for development.</h2>
        <p className="muted">
          The navigation, authentication, database connection, and page shell are already in place.
        </p>
      </article>
    </section>
  )
}
