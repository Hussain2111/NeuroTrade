from flask import request, jsonify
import subprocess
import sys
import os

def init_lstm_routes(app):
    @app.route('/run-lstm', methods=['POST'])
    def run_lstm():
        try:
            # Force UTF-8 encoding for stdout/stderr
            sys.stdout.reconfigure(encoding='utf-8', errors='replace') 
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
            
            data = request.get_json()
            ticker = data.get('ticker')
            
            if not ticker:
                return jsonify({
                    'error': 'No ticker provided',
                    'success': False
                }), 400
                
            # Update global ticker in app config
            app.config['GLOBAL_TICKER'] = ticker
            
            # Get the absolute path to lstm_files directory
            current_dir = os.path.dirname(os.path.abspath(__file__))
            lstm_script_path = os.path.join(current_dir, 'lstm_files', 'lstm_multivariate.py')
            
            # Define file paths for multivariate model outputs based on ticker
            model_loss_path = os.path.join(current_dir, 'lstm_files', f'{ticker}_model1_loss.png')
            prediction_plot_path = os.path.join(current_dir, 'lstm_files', f'{ticker}_prediction_plot.png')
            
            # Remove existing plots if they exist
            for path in [model_loss_path, prediction_plot_path]:
                if os.path.exists(path):
                    os.remove(path)
                    print(f"Removed existing plot: {path}")
            
            # Run the LSTM script with the ticker as a command line argument
            process = subprocess.run(
                [sys.executable, lstm_script_path, ticker],
                capture_output=True,
                text=True,
                encoding='utf-8',
                check=False
            )
            
            print(f"LSTM Output: {process.stdout}")
            if process.stderr:
                print(f"LSTM Errors: {process.stderr}")
            
            # Check for errors
            if process.returncode != 0:
                return jsonify({
                    'error': f'LSTM multivariate analysis failed: {process.stderr}',
                    'success': False
                }), 500
                
            return jsonify({
                'message': 'LSTM analysis completed successfully',
                'success': True
            })
            
        except Exception as e:
            print(f"Error in run_lstm: {str(e)}")  # Debug logging
            return jsonify({
                'error': str(e),
                'success': False
            }), 500