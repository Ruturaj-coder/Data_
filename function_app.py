import azure.functions as func
import logging
import json

app = func.FunctionApp()

@app.function_name(name="EventGridBlobTrigger")
@app.event_grid_trigger(arg_name="event")
def main(event: func.EventGridEvent):
    data = event.get_json()
    logging.info(f"Event received: {json.dumps(data)}")
    logging.info(f"Subject: {event.subject}")
    logging.info(f"Event Type: {event.event_type}")
