# app.R – Tabelle + Plus-Button + Modal-Formular mit INSERT
library(shiny)
library(bslib)
library(DBI)
library(RPostgres)
library(DT)
library(dplyr)
library(lubridate)
library(glue)

# ==== DB-Verbindung (lokal auf deinem Windows-Host) ====
# Achte auf den linken Host-Port aus Docker-Desktop (z. B. 32768)
Sys.setenv(PGHOST="localhost", PGPORT="32768",
           PGDATABASE="appdb", PGUSER="appuser", PGPASSWORD="abc123")

conn <- dbConnect(
  Postgres(),
  host     = Sys.getenv("PGHOST"),
  port     = as.integer(Sys.getenv("PGPORT","5432")),
  dbname   = Sys.getenv("PGDATABASE"),
  user     = Sys.getenv("PGUSER"),
  password = Sys.getenv("PGPASSWORD"),
  sslmode  = "prefer"
)
onStop(function() try(dbDisconnect(conn), silent = TRUE))

# ==== Hilfsfunktionen ====
fetch_tbl <- function(limit = 500) {
  dbGetQuery(conn, glue("
    SELECT id, abgabefrist, uhrzeit, ort, name, kurzbesch_auftrag,
           teilnahme, bearbeiter, abgegeben, vergabe_nr, link,
           created_at, updated_at
    FROM public.ausschreibungen
    ORDER BY COALESCE(abgabefrist, '9999-12-31') ASC, id ASC
    LIMIT {limit}
  "))
}

insert_row <- function(v) {
  sql <- "
    INSERT INTO public.ausschreibungen
    (abgabefrist, uhrzeit, ort, name, kurzbesch_auftrag,
     teilnahme, grund_bei_ablehnung, bearbeiter, bemerkung,
     abgegeben, abholfrist, fragefrist, besichtigung, bewertung,
     zuschlagsfrist, ausfuehrung, vergabe_nr, link, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now())
    RETURNING id;"
  dbGetQuery(conn, sql, params = unname(v))$id[[1]]
}

`%||%` <- function(a,b) if (is.null(a) || is.na(a) || a=="") b else a

# ==== UI ====
theme <- bs_theme(version = 5, bootswatch = "minty",
                  base_font = font_google("Inter"),
                  heading_font = font_google("Inter"))

ui <- page_navbar(
  theme = theme, title = "Ausschreibungen",
  nav_panel("Tabelle",
      div(class="d-flex align-items-center justify-content-between mb-2",
          sliderInput("limit", "Zeilen laden", min=50, max=5000, value=500, step=50, width = "300px"),
          actionButton("add", label = " Neu", icon = icon("plus"), class="btn btn-success")
      ),
      DTOutput("tbl")
  ),
  nav_panel("Dashboard",
      layout_column_wrap(
        width = 1/3,
        value_box(title = "Einträge gesamt", value = textOutput("kpi_total")),
        value_box(title = "Offen (nicht abgegeben)", value = textOutput("kpi_open")),
        value_box(title = "Nächste Frist", value = textOutput("kpi_next"))
      ),
      plotOutput("by_month", height = 360)
  )
)

# ==== SERVER ====
server <- function(input, output, session){

  # Daten reaktiv laden – pollt auf max(updated_at)
  data_r <- reactivePoll(5000, session,
    checkFunc = function() dbGetQuery(conn, "SELECT max(updated_at) AS m FROM public.ausschreibungen")$m,
    valueFunc = function() fetch_tbl(input$limit)
  )

  # Tabelle
  output$tbl <- renderDT({
    datatable(data_r(),
      options = list(pageLength = 25, scrollX = TRUE),
      rownames = FALSE
    )
  })

  # KPIs + Chart
  observe({
    df <- data_r()
    output$kpi_total <- renderText(nrow(df))
    output$kpi_open  <- renderText(sum(isFALSE(df$abgegeben) | is.na(df$abgegeben)))
    next_date <- df$abgabefrist[!is.na(df$abgabefrist)] |> sort() |> head(1)
    output$kpi_next <- renderText(if (length(next_date)) as.character(next_date) else "—")

    bym <- df |>
      mutate(monat = floor_date(abgabefrist, "month")) |>
      count(monat, name="n") |>
      arrange(monat)
    output$by_month <- renderPlot({
      plot(bym$monat, bym$n, type="b", xlab="Monat", ylab="Anzahl")
    })
  })

  # --- Modal öffnen ---
  observeEvent(input$add, {
    showModal(modalDialog(
      title = tagList(icon("plus"), " Neuen Datensatz anlegen"),
      size = "l",
      easyClose = TRUE,
      footer = tagList(
        modalButton("Abbrechen"),
        actionButton("save", "Speichern", class = "btn btn-primary")
      ),
      fluidRow(
        column(6,
          dateInput("m_abgabefrist", "Abgabefrist"),
          textInput("m_uhrzeit", "Uhrzeit"),
          textInput("m_ort", "Ort"),
          textInput("m_name", "Name"),
          textInput("m_kurz", "Kurzbesch. Auftrag"),
          selectInput("m_teilnahme", "Teilnahme?", c("", "Ja","Nein","Unklar"), selected="")
        ),
        column(6,
          textInput("m_grund_abl", "Grund b. Ablehnung"),
          textInput("m_bearbeiter", "Bearbeiter"),
          textAreaInput("m_bemerkung", "Bemerkung"),
          checkboxInput("m_abgegeben", "Abgegeben", value = FALSE),
          textInput("m_vergabe_nr", "Vergabe-Nr."),
          textInput("m_link", "Link")
        )
      ),
      tags$hr(),
      fluidRow(
        column(6,
          dateInput("m_abholfrist", "Abholfrist"),
          dateInput("m_fragefrist", "Fragefrist"),
          textInput("m_besichtigung", "Besichtigung"),
          textInput("m_bewertung", "Bewertung")
        ),
        column(6,
          dateInput("m_zuschlagsfrist", "Zuschlagsfrist"),
          textInput("m_ausfuehrung", "Ausführung")
        )
      )
    ))
  })

  # --- Speichern ---
  observeEvent(input$save, {
    # Minimale Validierung
    if (is.null(input$m_name) || trimws(input$m_name) == "") {
      showNotification("Bitte 'Name' ausfüllen.", type="warning"); return()
    }

    # Werte einsammeln (DateInputs liefern Date oder NULL)
    new_row <- list(
      input$m_abgabefrist %||% NA, input$m_uhrzeit %||% "", input$m_ort %||% "", input$m_name %||% "", input$m_kurz %||% "",
      input$m_teilnahme %||% "", input$m_grund_abl %||% "", input$m_bearbeiter %||% "", input$m_bemerkung %||% "",
      as.logical(input$m_abgegeben %||% FALSE), input$m_abholfrist %||% NA, input$m_fragefrist %||% NA,
      input$m_besichtigung %||% "", input$m_bewertung %||% "", input$m_zuschlagsfrist %||% NA,
      input$m_ausfuehrung %||% "", input$m_vergabe_nr %||% "", input$m_link %||% ""
    )

    id <- tryCatch(insert_row(new_row), error = function(e) { message(e); NULL })

    if (is.null(id)) {
      showNotification("Fehler beim Speichern.", type="error", duration = 5)
    } else {
      showNotification(glue("Gespeichert (ID {id})."), type="message")
      removeModal()
      # sanfter Refresh: reactivePoll lädt innerhalb max. 5s automatisch neu
      # optional: manuell triggern durch kurzzeitiges Ändern des Limits:
      updateSliderInput(session, "limit", value = input$limit) 
    }
  })
}

# Start-Einstellungen (VS Code öffnet nicht immer automatisch den Browser)
# shinyApp(ui, server, options = list(launch.browser = TRUE, host = "127.0.0.1", port = 7777))
shinyApp(ui, server)

# shiny::runApp(".", launch.browser=TRUE, port=7777)