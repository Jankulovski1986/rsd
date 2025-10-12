# app.R – Minimal zum Testen (liest aus public.ausschreibungen)
library(shiny)
library(DBI)
library(RPostgres)
library(DT)

Sys.setenv(PGHOST = "localhost", PGPORT = "32768",
           PGDATABASE = "appdb", PGUSER = "appuser", PGPASSWORD = "abc123")

conn <- dbConnect(
  Postgres(),
  host     = Sys.getenv("PGHOST"),
  port     = as.integer(Sys.getenv("PGPORT", "5432")),
  dbname   = Sys.getenv("PGDATABASE"),
  user     = Sys.getenv("PGUSER"),
  password = Sys.getenv("PGPASSWORD"),
  sslmode  = "prefer"
)
onStop(function() try(dbDisconnect(conn), silent = TRUE))

ui <- fluidPage(
  tags$h3("Ausschreibungen (Test)"),
  verbatimTextOutput("status"),
  DTOutput("tbl")
)

server <- function(input, output, session) {
  ok <- try(dbGetQuery(conn, "SELECT 1 AS ok"), silent = TRUE)
  output$status <- renderText(if (inherits(ok, "try-error")) "DB: ❌ keine Verbindung" else "DB: ✅ verbunden")

  df <- try(dbGetQuery(conn, "
    SELECT id, abgabefrist, ort, name, teilnahme, bearbeiter, abgegeben
    FROM public.ausschreibungen
    ORDER BY COALESCE(abgabefrist,'9999-12-31') ASC, id ASC
    LIMIT 200
  "), silent = TRUE)

  output$tbl <- renderDT({
    if (inherits(df, "try-error")) datatable(data.frame(Hinweis = "Tabelle noch leer oder DB nicht erreichbar"))
    else datatable(df, options = list(pageLength = 25, scrollX = TRUE))
  })
}

shinyApp(ui, server)