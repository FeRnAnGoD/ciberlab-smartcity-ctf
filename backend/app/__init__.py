from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_cors import CORS

db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)

    from datetime import timedelta
    from app.auth_config import JWT_SECRET_KEY

    import os
    # Configuración de base de datos y JWT
    app.config['SECRET_KEY'] = 'ciberlab_secret_key_2026'
    app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'mysql+pymysql://root:root@localhost/planta_gas')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Inicializar extensiones
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Registrar blueprints
    from app.api.auth import auth_bp
    from app.api.gas_cuadrante import gas_bp
    from app.api.maintenance import maintenance_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(gas_bp, url_prefix='/api/gas')
    app.register_blueprint(maintenance_bp)

    return app