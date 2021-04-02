# # Example of Setting Up Connection with BaseX
# https://{NEU login}@dsg.xmldb-dev.northeastern.edu/basex/webdav/psc/mhs/jqa/ .*xml

import os, mysql.connector
from sqlalchemy.orm import mapper, sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import sqlalchemy as db
import pandas as pd
import numpy as np

from xml_ET_parse_functions import *


"""
Declare global variables.
"""
# Declare regex to simplify file paths below
regex = re.compile(r'.*/\d{4}/(.*)')

# Declare document level of file. Requires root starting point ('.').
doc_as_xpath = './/ns:div/[@type="entry"]'


"""
Main
"""
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print ('Expected command: basex-template.py <login> <pw>')
        exit(-1)

    engine = db.create_engine(f'mysql+mysqlconnector://{sys.argv[1]}:{sys.argv[2]}@dsg.xmldb-dev.northeastern.edu/basex/webdav/psc/mhs/jqa/')

    inspection = db.inspect(engine)
    db_list = inspection.get_schema_names()

    print (db_list)
