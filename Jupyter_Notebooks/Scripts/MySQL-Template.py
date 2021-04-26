# # Example of Setting Up Connection with BaseX
# https://{NEU login}@dsg.xmldb-dev.northeastern.edu/basex/webdav/psc/mhs/jqa/ .*xml

import os, mysql.connector, getpass
from sqlalchemy.orm import mapper, sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import sqlalchemy as db
import pandas as pd
import numpy as np

from functions_xml_ET_parse import *


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
    if len(sys.argv) != 1:
        print ('Expected command: basex-template.py')
        exit(-1)

    usr_login = input("User Login: ")
    usr_pw = getpass.getpass('Password: ')

    engine = db.create_engine(f'mysql+mysqlconnector://{usr_login}:{usr_pw}@dsg.xmldb-dev.northeastern.edu/basex/webdav/psc/mhs/jqa/')

    inspection = db.inspect(engine)
    db_list = inspection.get_schema_names()

    print (db_list)
