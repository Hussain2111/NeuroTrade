from flask import request, jsonify
import glob
import os

# Live per-request LSTM training (the original behaviour here) takes minutes
# of CPU-heavy TensorFlow work and has no place behind a public endpoint —
# it would time out on any real host and let anyone load down the server by
# repeatedly hitting it. Instead this demo serves predictions that were
# generated ahead of time and committed under lstm_files/. Retrain a ticker
# locally (python lstm_files/lstm_multivariate.py TICKER) and commit its
# output files to add it to the available set.

def _available_tickers(lstm_files_dir):
    pattern = os.path.join(lstm_files_dir, '*_prediction_plot.png')
    return sorted(
        os.path.basename(p)[: -len('_prediction_plot.png')]
        for p in glob.glob(pattern)
    )


def init_lstm_routes(app):
    @app.route('/run-lstm', methods=['POST'])
    def run_lstm():
        try:
            data = request.get_json()
            ticker = data.get('ticker')

            if not ticker:
                return jsonify({
                    'error': 'No ticker provided',
                    'success': False
                }), 400

            current_dir = os.path.dirname(os.path.abspath(__file__))
            lstm_files_dir = os.path.join(current_dir, 'lstm_files')
            prediction_plot_path = os.path.join(lstm_files_dir, f'{ticker}_prediction_plot.png')

            if not os.path.exists(prediction_plot_path):
                return jsonify({
                    'error': (
                        f'No pre-generated prediction for "{ticker}" in this demo. '
                        f'Available tickers: {", ".join(_available_tickers(lstm_files_dir)) or "none yet"}.'
                    ),
                    'success': False
                }), 400

            # Update global ticker in app config so /get-prediction knows what to serve
            app.config['GLOBAL_TICKER'] = ticker

            return jsonify({
                'message': 'Using pre-generated prediction for this ticker',
                'success': True
            })

        except Exception as e:
            print(f"Error in run_lstm: {str(e)}")  # Debug logging
            return jsonify({
                'error': str(e),
                'success': False
            }), 500